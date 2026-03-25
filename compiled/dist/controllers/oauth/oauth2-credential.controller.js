"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuth2CredentialController = void 0;
const client_oauth2_1 = require("@n8n/client-oauth2");
const decorators_1 = require("@n8n/decorators");
const axios_1 = __importDefault(require("axios"));
const omit_1 = __importDefault(require("lodash/omit"));
const set_1 = __importDefault(require("lodash/set"));
const split_1 = __importDefault(require("lodash/split"));
const n8n_workflow_1 = require("n8n-workflow");
const pkce_challenge_1 = __importDefault(require("pkce-challenge"));
const qs = __importStar(require("querystring"));
const abstract_oauth_controller_1 = require("./abstract-oauth.controller");
const oauth2_dynamic_client_registration_schema_1 = require("./oauth2-dynamic-client-registration.schema");
const constants_1 = require("../../constants");
const bad_request_error_1 = require("../../errors/response-errors/bad-request.error");
let OAuth2CredentialController = class OAuth2CredentialController extends abstract_oauth_controller_1.AbstractOAuthController {
    constructor() {
        super(...arguments);
        this.oauthVersion = 2;
    }
    async getAuthUri(req) {
        const credential = await this.getCredential(req);
        const additionalData = await this.getAdditionalData();
        const decryptedDataOriginal = await this.getDecryptedDataForAuthUri(credential, additionalData);
        if (decryptedDataOriginal?.scope &&
            credential.type.includes('OAuth2') &&
            !constants_1.GENERIC_OAUTH2_CREDENTIALS_WITH_EDITABLE_SCOPE.includes(credential.type)) {
            delete decryptedDataOriginal.scope;
        }
        const oauthCredentials = await this.applyDefaultsAndOverwrites(credential, decryptedDataOriginal, additionalData);
        const toUpdate = {};
        if (oauthCredentials.useDynamicClientRegistration && oauthCredentials.serverUrl) {
            const serverUrl = new URL(oauthCredentials.serverUrl);
            const { data } = await axios_1.default.get(`${serverUrl.origin}/.well-known/oauth-authorization-server`);
            const metadataValidation = oauth2_dynamic_client_registration_schema_1.oAuthAuthorizationServerMetadataSchema.safeParse(data);
            if (!metadataValidation.success) {
                throw new bad_request_error_1.BadRequestError(`Invalid OAuth2 server metadata: ${metadataValidation.error.issues.map((e) => e.message).join(', ')}`);
            }
            const { authorization_endpoint, token_endpoint, registration_endpoint, scopes_supported } = metadataValidation.data;
            oauthCredentials.authUrl = authorization_endpoint;
            oauthCredentials.accessTokenUrl = token_endpoint;
            toUpdate.authUrl = authorization_endpoint;
            toUpdate.accessTokenUrl = token_endpoint;
            const scope = scopes_supported ? scopes_supported.join(' ') : undefined;
            if (scope) {
                oauthCredentials.scope = scope;
                toUpdate.scope = scope;
            }
            const { grantType, authentication } = this.selectGrantTypeAndAuthenticationMethod(metadataValidation.data.grant_types_supported ?? ['authorization_code', 'implicit'], metadataValidation.data.token_endpoint_auth_methods_supported ?? ['client_secret_basic'], metadataValidation.data.code_challenge_methods_supported ?? []);
            oauthCredentials.grantType = grantType;
            toUpdate.grantType = grantType;
            if (authentication) {
                oauthCredentials.authentication = authentication;
                toUpdate.authentication = authentication;
            }
            const { grant_types, token_endpoint_auth_method } = this.mapGrantTypeAndAuthenticationMethod(grantType, authentication);
            const registerPayload = {
                redirect_uris: [`${this.baseUrl}/callback`],
                token_endpoint_auth_method,
                grant_types,
                response_types: ['code'],
                client_name: 'n8n',
                client_uri: 'https://n8n.io/',
                scope,
            };
            await this.externalHooks.run('oauth2.dynamicClientRegistration', [registerPayload]);
            const { data: registerResult } = await axios_1.default.post(registration_endpoint, registerPayload);
            const registrationValidation = oauth2_dynamic_client_registration_schema_1.dynamicClientRegistrationResponseSchema.safeParse(registerResult);
            if (!registrationValidation.success) {
                throw new bad_request_error_1.BadRequestError(`Invalid client registration response: ${registrationValidation.error.issues.map((e) => e.message).join(', ')}`);
            }
            const { client_id, client_secret } = registrationValidation.data;
            oauthCredentials.clientId = client_id;
            toUpdate.clientId = client_id;
            if (client_secret) {
                oauthCredentials.clientSecret = client_secret;
                toUpdate.clientSecret = client_secret;
            }
        }
        const [csrfSecret, state] = this.createCsrfState(credential.id, abstract_oauth_controller_1.skipAuthOnOAuthCallback ? undefined : req.user.id);
        const oAuthOptions = {
            ...this.convertCredentialToOptions(oauthCredentials),
            state,
        };
        if (oauthCredentials.authQueryParameters) {
            oAuthOptions.query = qs.parse(oauthCredentials.authQueryParameters);
        }
        await this.externalHooks.run('oauth2.authenticate', [oAuthOptions]);
        toUpdate.csrfSecret = csrfSecret;
        if (oauthCredentials.grantType === 'pkce') {
            const { code_verifier, code_challenge } = await (0, pkce_challenge_1.default)();
            oAuthOptions.query = {
                ...oAuthOptions.query,
                code_challenge,
                code_challenge_method: 'S256',
            };
            toUpdate.codeVerifier = code_verifier;
        }
        await this.encryptAndSaveData(credential, toUpdate);
        const oAuthObj = new client_oauth2_1.ClientOAuth2(oAuthOptions);
        const returnUri = oAuthObj.code.getUri();
        this.logger.debug('OAuth2 authorization url created for credential', {
            userId: req.user.id,
            credentialId: credential.id,
        });
        return returnUri.toString();
    }
    async handleCallback(req, res) {
        try {
            const { code, state: encodedState } = req.query;
            if (!code || !encodedState) {
                return this.renderCallbackError(res, 'Insufficient parameters for OAuth2 callback.', `Received following query parameters: ${JSON.stringify(req.query)}`);
            }
            const [credential, decryptedDataOriginal, oauthCredentials] = await this.resolveCredential(req);
            let options = {};
            const oAuthOptions = this.convertCredentialToOptions(oauthCredentials);
            if (oauthCredentials.grantType === 'pkce') {
                options = {
                    body: { code_verifier: decryptedDataOriginal.codeVerifier },
                };
            }
            else if (oauthCredentials.authentication === 'body') {
                options = {
                    body: {
                        ...(oAuthOptions.body ?? {}),
                        client_id: oAuthOptions.clientId,
                        client_secret: oAuthOptions.clientSecret,
                    },
                };
                delete oAuthOptions.clientSecret;
            }
            await this.externalHooks.run('oauth2.callback', [oAuthOptions]);
            const oAuthObj = new client_oauth2_1.ClientOAuth2(oAuthOptions);
            const queryParameters = req.originalUrl.split('?').splice(1, 1).join('');
            const oauthToken = await oAuthObj.code.getToken(`${oAuthOptions.redirectUri}?${queryParameters}`, options);
            if (Object.keys(req.query).length > 2) {
                (0, set_1.default)(oauthToken.data, 'callbackQueryString', (0, omit_1.default)(req.query, 'state', 'code'));
            }
            let { oauthTokenData } = decryptedDataOriginal;
            oauthTokenData = {
                ...(typeof oauthTokenData === 'object' ? oauthTokenData : {}),
                ...oauthToken.data,
            };
            await this.encryptAndSaveData(credential, { oauthTokenData }, ['csrfSecret']);
            this.logger.debug('OAuth2 callback successful for credential', {
                credentialId: credential.id,
            });
            return res.render('oauth-callback');
        }
        catch (e) {
            const error = (0, n8n_workflow_1.ensureError)(e);
            return this.renderCallbackError(res, error.message, 'body' in error ? (0, n8n_workflow_1.jsonStringify)(error.body) : undefined);
        }
    }
    convertCredentialToOptions(credential) {
        const options = {
            clientId: credential.clientId,
            clientSecret: credential.clientSecret ?? '',
            accessTokenUri: credential.accessTokenUrl ?? '',
            authorizationUri: credential.authUrl ?? '',
            authentication: credential.authentication ?? 'header',
            redirectUri: `${this.baseUrl}/callback`,
            scopes: (0, split_1.default)(credential.scope ?? 'openid', ','),
            scopesSeparator: credential.scope?.includes(',') ? ',' : ' ',
            ignoreSSLIssues: credential.ignoreSSLIssues ?? false,
        };
        if (credential.additionalBodyProperties &&
            typeof credential.additionalBodyProperties === 'string') {
            const parsedBody = (0, n8n_workflow_1.jsonParse)(credential.additionalBodyProperties);
            if (parsedBody) {
                options.body = parsedBody;
            }
        }
        return options;
    }
    selectGrantTypeAndAuthenticationMethod(grantTypes, tokenEndpointAuthMethods, codeChallengeMethods) {
        if (grantTypes.includes('authorization_code') && grantTypes.includes('refresh_token')) {
            if (codeChallengeMethods.includes('S256')) {
                return { grantType: 'pkce' };
            }
            if (tokenEndpointAuthMethods.includes('client_secret_basic')) {
                return { grantType: 'authorizationCode', authentication: 'header' };
            }
            if (tokenEndpointAuthMethods.includes('client_secret_post')) {
                return { grantType: 'authorizationCode', authentication: 'body' };
            }
        }
        if (grantTypes.includes('client_credentials')) {
            if (tokenEndpointAuthMethods.includes('client_secret_basic')) {
                return { grantType: 'clientCredentials', authentication: 'header' };
            }
            if (tokenEndpointAuthMethods.includes('client_secret_post')) {
                return { grantType: 'clientCredentials', authentication: 'body' };
            }
        }
        throw new bad_request_error_1.BadRequestError('No supported grant type and authentication method found');
    }
    mapGrantTypeAndAuthenticationMethod(grantType, authentication) {
        if (grantType === 'pkce') {
            return {
                grant_types: ['authorization_code', 'refresh_token'],
                token_endpoint_auth_method: 'none',
            };
        }
        const tokenEndpointAuthMethod = authentication === 'header' ? 'client_secret_basic' : 'client_secret_post';
        if (grantType === 'authorizationCode') {
            return {
                grant_types: ['authorization_code', 'refresh_token'],
                token_endpoint_auth_method: tokenEndpointAuthMethod,
            };
        }
        return {
            grant_types: ['client_credentials'],
            token_endpoint_auth_method: tokenEndpointAuthMethod,
        };
    }
};
exports.OAuth2CredentialController = OAuth2CredentialController;
__decorate([
    (0, decorators_1.Get)('/auth'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OAuth2CredentialController.prototype, "getAuthUri", null);
__decorate([
    (0, decorators_1.Get)('/callback', { usesTemplates: true, skipAuth: abstract_oauth_controller_1.skipAuthOnOAuthCallback }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2CredentialController.prototype, "handleCallback", null);
exports.OAuth2CredentialController = OAuth2CredentialController = __decorate([
    (0, decorators_1.RestController)('/oauth2-credential')
], OAuth2CredentialController);
//# sourceMappingURL=oauth2-credential.controller.js.map