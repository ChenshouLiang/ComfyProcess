import pino from 'pino';
import WebSocket from 'ws';

const logger = pino({
  level: 'info',
});

export class ComfyUIClient {
  constructor(serverAddress, clientId) {
    this.serverAddress = serverAddress;
    this.clientId = clientId;
  }

  connect() {
    return new Promise(async (resolve) => {
      if (this.ws) {
        await this.disconnect();
      }
      const url = `ws://${this.serverAddress}/ws?clientId=${this.clientId}`;
      logger.info(`Connecting to url: ${url}`);

      this.ws = new WebSocket(url, {
        perMessageDeflate: false,
      });

      this.ws.on('open', () => {
        logger.info('Connection open');
        resolve();
      });

      this.ws.on('close', () => {
        logger.info('Connection closed');
      });

      this.ws.on('error', (err) => {
        logger.error({ err }, 'WebSockets error');
      });

      this.ws.on('message', (data, isBinary) => {
        if (isBinary) {
          logger.debug('Received binary data');
        } else {
          logger.debug('Received data: %s', data.toString());
        }
      });
    })
  }

  // 没有连接上重新连接
  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  async uploadImage(image, filename, overwrite) {
    const formData = new FormData();
    formData.append('image', new Blob([image]), filename);
    if (overwrite !== undefined) {
      formData.append('overwrite', overwrite.toString());
    }
    const res = await fetch(`http://${this.serverAddress}/upload/image`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getEmbeddings(){
    const res = await fetch(`http://${this.serverAddress}/embeddings`);
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async queuePrompt(prompt){
    const res = await fetch(`http://${this.serverAddress}/prompt`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        client_id: this.clientId,
      }),
    });
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async interrupt(){
    const res = await fetch(`http://${this.serverAddress}/interrupt`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
  }

  async editHistory(params) {
    const res = await fetch(`http://${this.serverAddress}/history`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const json = await res.json();

    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
  }

  async getImage( filename, subfolder, type ){
    const res = await fetch(`http://${this.serverAddress}/view?` + new URLSearchParams({
        filename,
        subfolder,
        type
      })
    );
    const blob = await res.blob();
    return blob;
  }

  async viewMetadata( folderName, filename ){
    const res = await fetch(
      `http://${this.serverAddress}/view_metadata/${folderName}?filename=${filename}`,
    );
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getSystemStats(){
    const res = await fetch(`http://${this.serverAddress}/system_stats`);
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getPrompt(){
    const res = await fetch(`http://${this.serverAddress}/prompt`);
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getObjectInfo(nodeClass){
    const res = await fetch(`http://${this.serverAddress}/object_info` + (nodeClass ? `/${nodeClass}` : ''));
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getHistory(promptId){
    const res = await fetch(
      `http://${this.serverAddress}/history` + (promptId ? `/${promptId}` : ''),
    );
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getQueue(){
    const res = await fetch(`http://${this.serverAddress}/queue`);
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getImages(prompt) {
    const queue = await this.queuePrompt(prompt);
    const promptId = queue.prompt_id;
    return new Promise((resolve, reject) => {
      const outputImages = {}
      const onMessage = async(data, isBinary) => {
        if (isBinary) {
          return
        }
        try {
          const message = JSON.parse(data.toString())
          if (message.type === 'executing') {
            const messageData = message.data;
            if (!messageData.node) {
              const donePromptId = messageData.prompt_id;
              logger.info(`已执行提示（ID: ${donePromptId})`)
              if (messageData.prompt_id === promptId) {
                //根据promptId 获取历史
                const historyRes = await this.getHistory(promptId);
                //根据promptId 返回图片
                const history = historyRes[promptId];
                // 处理多张图片
                for (const nodeId of Object.keys(history.outputs)) {
                  // 获取key,去取值
                  const nodeOutput = history.outputs[nodeId];
                  // 判断有没有图片
                  if (nodeOutput.images) {
                    // 用于存放图片
                    const imagesOutput = []
                    for (const image of nodeOutput.images) {
                      // 处理图片转blob
                      const blob = await this.getImage(
                        image.filename,
                        image.subfolder,
                        image.type,
                      );
                      imagesOutput.push({
                        blob,
                        image,
                      });
                    }
                    outputImages[nodeId] = imagesOutput
                  }
                }
                this.ws?.off('message', onMessage);
                return resolve(outputImages);
              }
            }
          }
        } catch (err) {
          return reject(err);
        }
      }
      this.ws?.on('message', onMessage);
    })
  }
}