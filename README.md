## Install

yarn add comfy-process

```js
import { ComfyUIClient } from 'comfy-process';

//
const serverAddress = '127.0.0.1:8189';
const clientId = 'baadbabe-b00b-4206-9420-deadd00d1337';
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

