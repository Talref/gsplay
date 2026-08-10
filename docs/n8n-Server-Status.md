# Send server status from n8n

## GSPlay configuration

Generate a token:

```bash
openssl rand -hex 32
```

Add it to `/etc/gsplay/v2.env`, then deploy or restart the API:

```env
SERVER_STATUS_INTEGRATION_TOKEN=<generated-token>
```

## n8n Code node

Connect a new Code node to the existing server-status output, before Discord formatting:

```js
const servers = $input.all().map((item) => item.json);

return [
  {
    json: {
      sourceUpdatedAt: new Date().toISOString(),
      servers
    }
  }
];
```

Run this branch only after the AMP and Pterodactyl status checks complete successfully.

## HTTP Request node

- Method: `PUT`
- URL: `https://gsplay.daje.cc/api/v2/integrations/server-status`
- Authentication setting: `None` (use the header below)
- Header `Authorization`: `Bearer <generated-token>`
- Header `Content-Type`: `application/json`
- Body type: JSON
- Body: `{{ $json }}`

## JSON sent to GSPlay

```json
{
  "sourceUpdatedAt": "2026-08-10T12:34:56.000Z",
  "servers": [
    {
      "groupId": "landover",
      "groupName": "Landover GS server",
      "managerMention": "<@DISCORD_USER_ID>",
      "name": "GSplay Palworld",
      "identifier": "8209baa0",
      "status": "running",
      "uptimeMilliseconds": 14276045
    },
    {
      "groupId": "jamserver",
      "groupName": "Jam GS server",
      "managerMention": "<@DISCORD_USER_ID>",
      "provider": "amp",
      "name": "Project Zomboid GS",
      "identifier": "64e0cec5-40ae-4369-9af2-17c750810979",
      "status": "running",
      "uptimeMilliseconds": null,
      "players": 0,
      "maxPlayers": 24,
      "ampAppState": 20
    }
  ]
}
```

Supported status values: `running`, `starting`, `stopping`, `offline`, `unknown`, `idle`.

GSPlay accepts `provider` and `ampAppState` from the existing workflow but does not store them.

## Successful response

```json
{
  "snapshot": {
    "sourceUpdatedAt": "2026-08-10T12:34:56.000Z",
    "receivedAt": "2026-08-10T12:34:56.250Z",
    "serverCount": 2
  }
}
```
