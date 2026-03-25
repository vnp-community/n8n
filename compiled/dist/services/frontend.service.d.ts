import type { FrontendSettings } from '@n8n/api-types';
import { LicenseState, Logger, ModuleRegistry } from '@n8n/backend-common';
import { GlobalConfig, SecurityConfig } from '@n8n/config';
import { BinaryDataConfig, InstanceSettings } from 'n8n-core';
import { UrlService } from './url.service';
import { CredentialTypes } from '../credential-types';
import { CredentialsOverwrites } from '../credentials-overwrites';
import { License } from '../license';
import { LoadNodesAndCredentials } from '../load-nodes-and-credentials';
import { MfaService } from '../mfa/mfa.service';
import { PushConfig } from '../push/push.config';
import { UserManagementMailer } from '../user-management/email';
export type PublicFrontendSettings = {
    settingsMode: FrontendSettings['settingsMode'];
    previewMode: FrontendSettings['previewMode'];
    authCookie: {
        secure: FrontendSettings['authCookie']['secure'];
    };
    userManagement: {
        authenticationMethod: FrontendSettings['userManagement']['authenticationMethod'];
        showSetupOnFirstLoad: FrontendSettings['userManagement']['showSetupOnFirstLoad'];
        smtpSetup: FrontendSettings['userManagement']['smtpSetup'];
    };
    enterprise: {
        saml: FrontendSettings['enterprise']['saml'];
        oidc: FrontendSettings['enterprise']['oidc'];
        ldap: FrontendSettings['enterprise']['ldap'];
    };
    sso: {
        saml: {
            loginEnabled: FrontendSettings['sso']['saml']['loginEnabled'];
        };
        ldap: {
            loginEnabled: FrontendSettings['sso']['ldap']['loginEnabled'];
            loginLabel: FrontendSettings['sso']['ldap']['loginLabel'];
        };
        oidc: {
            loginEnabled: FrontendSettings['sso']['oidc']['loginEnabled'];
            loginUrl: FrontendSettings['sso']['oidc']['loginUrl'];
        };
    };
};
export declare class FrontendService {
    private readonly globalConfig;
    private readonly logger;
    private readonly loadNodesAndCredentials;
    private readonly credentialTypes;
    private readonly credentialsOverwrites;
    private readonly license;
    private readonly mailer;
    private readonly instanceSettings;
    private readonly urlService;
    private readonly securityConfig;
    private readonly pushConfig;
    private readonly binaryDataConfig;
    private readonly licenseState;
    private readonly moduleRegistry;
    private readonly mfaService;
    settings: FrontendSettings;
    private communityPackagesService?;
    constructor(globalConfig: GlobalConfig, logger: Logger, loadNodesAndCredentials: LoadNodesAndCredentials, credentialTypes: CredentialTypes, credentialsOverwrites: CredentialsOverwrites, license: License, mailer: UserManagementMailer, instanceSettings: InstanceSettings, urlService: UrlService, securityConfig: SecurityConfig, pushConfig: PushConfig, binaryDataConfig: BinaryDataConfig, licenseState: LicenseState, moduleRegistry: ModuleRegistry, mfaService: MfaService);
    private collectEnvFeatureFlags;
    private initSettings;
    generateTypes(): Promise<void>;
    getSettings(): FrontendSettings;
    getPublicSettings(): PublicFrontendSettings;
    getModuleSettings(): {
        [k: string]: import("@n8n/decorators").ModuleSettings;
    };
    private writeStaticJSON;
    private overwriteCredentialsProperties;
}
