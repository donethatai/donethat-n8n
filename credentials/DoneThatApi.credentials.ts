import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

import {API_BASE_URL, API_DOCS_URL} from '../nodes/DoneThat/constants';

export class DoneThatApi implements ICredentialType {
  name = 'doneThatApi';

  displayName = 'DoneThat API';

  documentationUrl = API_DOCS_URL;

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description:
        'Create an API key at https://app.donethat.ai → Settings → API Access. ' +
        `Requires user:read for credential testing. Scopes and endpoints: ${API_DOCS_URL}`,
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: API_BASE_URL,
      required: true,
      description: 'Default: https://api.donethat.ai',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'x-api-key': '={{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/user',
    },
  };
}
