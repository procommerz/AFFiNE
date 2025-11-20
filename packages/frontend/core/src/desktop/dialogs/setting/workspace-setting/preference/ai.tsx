import { Input, Switch, Wrapper, FlexWrapper, notify } from '@affine/component';
import {
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { useWorkspaceInfo } from '@affine/core/components/hooks/use-workspace-info';
import { ServerService } from '@affine/core/modules/cloud';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { WorkspaceShareSettingService } from '@affine/core/modules/share-setting';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { setAiIdentityMutation } from '@affine/graphql';

export const AiSetting = () => {
  const t = useI18n();
  const workspace = useService(WorkspaceService).workspace;
  const workspaceInfo = useWorkspaceInfo(workspace);

  const shareSetting = useService(WorkspaceShareSettingService).sharePreview;
  const serverService = useService(ServerService);
  const serverEnableAi = useLiveData(
    serverService.server.features$.map(f => f?.copilot)
  );
  const workspaceEnableAi = useLiveData(shareSetting.enableAi$);
  const loading = useLiveData(shareSetting.isLoading$);
  const permissionService = useService(WorkspacePermissionService);
  const isOwner = useLiveData(permissionService.permission.isOwner$);
  const currentAiIdentity = useLiveData(workspace.aiIdentity$);

  const [aiIdentityInput, setAiIdentityInput] = useState<string>('');

  useEffect(() => {
    setAiIdentityInput(currentAiIdentity ?? '');
  }, [currentAiIdentity]);

  const toggleAi = useAsyncCallback(
    async (checked: boolean) => {
      await shareSetting.setEnableAi(checked);
    },
    [shareSetting]
  );

  if (!isOwner || !serverEnableAi) {
    return null;
  }
  
  const setWorkspaceAiIdentity = useCallback(
    async (aiIdentity: string) => {
      if (!workspace) {
        return;
      }
      workspace.setAiIdentity(aiIdentity);

      await serverService.server.gql({
        query: setAiIdentityMutation,
        variables: {
          id: workspace.id,
          aiIdentity,
        },
      });
    },
    [workspace]
  );

  const handleUpdateWorkspaceAiIdentity = useCallback(
    (aiIdentity: string) => {
      setWorkspaceAiIdentity(aiIdentity);
      notify.success({ title: t['Update workspace AI identity success']() });
    },
    [setWorkspaceAiIdentity, t]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.code === 'Enter' && aiIdentityInput !== currentAiIdentity) {
        handleUpdateWorkspaceAiIdentity(aiIdentityInput);
      }
    },
    [handleUpdateWorkspaceAiIdentity, aiIdentityInput, currentAiIdentity]
  );

  return (
    <SettingWrapper
      title={t['com.affine.settings.workspace.affine-ai.title']()}
    >
      <SettingRow
        name={t['com.affine.settings.workspace.affine-ai.label']()}
        desc={t['com.affine.settings.workspace.affine-ai.description']()}
      >
        <Switch
          checked={!!workspaceEnableAi}
          onChange={toggleAi}
          disabled={loading}
        />
      </SettingRow>

      <SettingRow
        name={t['Workspace AI Identity']()}
        desc={'AI identity prompt part for AI chats in this workspace'}
      >        
        <textarea    
            value={aiIdentityInput}
            style={{ width: 280, fontSize: 12, opacity: 0.85, border: '1px solid #777', borderRadius: 8, padding: 8, resize: 'vertical' }}
            rows={8}
            data-testid="workspace-ai-identity-input"
            placeholder={t['AI Identity text']()}
            minLength={0}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAiIdentityInput(e.target.value)}
            onKeyUp={(e: KeyboardEvent<HTMLTextAreaElement>) => handleKeyUp(e)}
          />
      </SettingRow>
    </SettingWrapper>
  );
};
