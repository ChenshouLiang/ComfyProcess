## Install

yarn add comfy-process

```js
import { ComfyUIClient } from 'comfy-process';
import { v4 as uuidv4 } from 'uuid';
//
const serverAddress = '127.0.0.1:8189';
const clientId = uuidv4();
const client = new ComfyUIClient(serverAddress, clientId);

// 连接comfy服务器
await client.connect();
// 生成图片
const images = await client.getImages(prompt);

// 将图片保存到文件
const outputDir = './tmp/output';
await client.saveImages(images, outputDir);

// 断开comfy连接
await client.disconnect();
```

```js
import { ComfyUIWeb } from 'comfy-process';
const client = new ComfyUIClient('127.0.0.1:8189');
const images = await client.genWithWorkflow(prompt)
// 将url转Blob
await client.urlToBlob(url);
// 传值 (图片图片名称)
await client.uploadImage(image, filename)
// 数据合并(数据，规则)
await client.updateObject(payload,feature)
```

