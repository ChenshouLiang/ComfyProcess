import { writeFile } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';
import WebSocket from 'ws';

const logger = pino({
  level: 'info',
});

export class ComfyUIWeb {
  constructor(serverAddress) {
    this.serverAddress = serverAddress;
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

  async getEmbeddings() {
    const res = await fetch(`http://${this.serverAddress}/embeddings`);
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async queuePrompt(prompt) {
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

  async interrupt() {
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

  async getImage(filename, subfolder, type) {
    const res = await fetch(`http://${this.serverAddress}/view?` + new URLSearchParams({
      filename,
      subfolder,
      type
    })
    );
    const blob = await res.blob();
    return blob;
  }

  async viewMetadata(folderName, filename) {
    const res = await fetch(
      `http://${this.serverAddress}/view_metadata/${folderName}?filename=${filename}`,
    );
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getSystemStats() {
    const res = await fetch(`http://${this.serverAddress}/system_stats`);
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getPrompt() {
    const res = await fetch(`http://${this.serverAddress}/prompt`);
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getObjectInfo(nodeClass) {
    const res = await fetch(`http://${this.serverAddress}/object_info` + (nodeClass ? `/${nodeClass}` : ''));
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getHistory(promptId) {
    const res = await fetch(
      `http://${this.serverAddress}/history` + (promptId ? `/${promptId}` : ''),
    );
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async getQueue() {
    const res = await fetch(`http://${this.serverAddress}/queue`);
    const json = await res.json();
    if ('error' in json) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  }

  async saveImages(response, outputDir) {
    for (const nodeId of Object.keys(response)) {
      for (const img of response[nodeId]) {
        const arrayBuffer = await img.blob.arrayBuffer();
        const outputPath = join(outputDir, img.image.filename);
        await writeFile(outputPath, Buffer.from(arrayBuffer));
      }
    }
  }

  async paramObj(url) {
    const search = decodeURIComponent(url.split('?')[1]).replace(/\+/g, ' ')
    if (!search) {
      return {}
    }
    const obj = {}
    const searchArr = search.split('&')
    searchArr.forEach(v => {
      const index = v.indexOf('=')
      if (index !== -1) {
        const name = v.substring(0, index)
        const val = v.substring(index + 1, v.length)
        obj[name] = val
      }
    })
    return obj
  }

  // url转Blob
  async urlToBlob(url) {
    let { filename, subfolder, type } = await param2Obj(url)
    const blob = await getImage(filename, subfolder, type)
    return blob
  }

  // 查找节点然后覆盖数据
  async updateObject(objects,updatedObject) {
    if (objects.hasOwnProperty(id)) {
      objects[id].inputs = { ...objects[id].inputs, ...updatedObject }
    }
  }

  async genWithWorkflow(prompt) {
    const queue = await this.queuePrompt(prompt);
    const promptId = queue.prompt_id;
    return new Promise(async (resolve, reject) => {
      const outputImages = {}
      let isProcessComplete = false
      try {
        while (!isProcessComplete) {
          // 获取图片进度
          const queueInfo = await getQueue();
          if (queueInfo.queue_running.length === 0 && queueInfo.queue_pending.length === 0) {
            isProcessComplete = true
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        //根据promptId 获取历史
        const historyRes = await this.getHistory(promptId);
        //根据promptId 返回图片
        const history = historyRes[promptId];
        // 处理多多个节点
        for (const nodeId of Object.keys(history.outputs)) {
          // 获取key_nodeId,去取值
          const nodeOutput = history.outputs[nodeId];
          if (nodeOutput.images) {
            // 用于存放图片
            const imagesOutput = []
            for (const item of nodeOutput.images) {
              const imageUrl = `${this.serverAddress}/view?subfolder=${item.subfolder}&type=${item.type}&filename=${item.filename}`
              imagesOutput.push(imageUrl);
            }
            outputImages[nodeId] = imagesOutput
          }
        }
        return resolve(outputImages);
      } catch (err) {
        return reject(err);
      }
    })
  }
}