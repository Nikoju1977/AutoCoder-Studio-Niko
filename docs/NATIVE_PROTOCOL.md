# Studio Niko Tools Protocol 1

Local request-response JSON, independent of MCP. No HTTP listener, no authentication server, no provider credentials. The operating-system user launching the gateway is the trust boundary. The app name is a label, not an authenticated identity. Do not expose the gateway to remote or untrusted clients.

Request example:
```json
{"protocol":"studio-niko-tools/1","id":"req-1","method":"tools.call","params":{"name":"project.audit","args":{}}}
```

Methods: tools.list (empty params), tools.call (name and args). Responses echo protocol and id, with ok:true/result or ok:false/error.code. Maximum request 24 KB, response 256 KB. One request per subprocess; in-process gateway has a session budget. Operator supplies project JSON and optional --quantum-simulation at process launch, not in request. Network, publication, physical QPU and arbitrary shell tools are not exposed.

JavaScript Node client:
```js
import {localClient} from './sdk/client.mjs';
const c=localClient({gateway:'./scripts/gateway.mjs',app:'audio',project:'./project.json'});
console.log(await c.list());
console.log(await c.call('project.audit'));
```

Python (from repository root):
```python
from sdk.client import Client
c = Client("scripts/gateway.mjs", "audio", "project.json")
print(c.list())
print(c.call("project.audit"))
```

Both require Node 20+; Python client uses standard library only. The project file is chosen by the local operator; the gateway does not open paths supplied by JSON requests. Do not treat local subprocess isolation as a security sandbox. Tool extensions require reviewed changes to the native registry; third-party arbitrary plugins and remote application authentication are not implemented.
