import { ComfyUIWeb } from '../direct';
import fetch from 'node-fetch';
import { Blob } from 'blob-polyfill';

// 使用Jest提供的模拟功能来模拟fetch和Blob
global.fetch = jest.fn(fetch);
global.Blob = Blob;

describe('ComfyUIWeb 类测试', () => {
  let comfyUIWeb;

  beforeEach(() => {
    comfyUIWeb = new ComfyUIWeb('http://localhost:3000');
    fetch.mockReset();
  });

  test('uploadImage 方法测试', async () => {
    const image = Buffer.from('image data');
    const filename = 'test.png';
    const overwrite = true;

    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        json: () => Promise.resolve({}),
      })
    );

    await comfyUIWeb.uploadImage(image, filename, overwrite);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/upload/image',
      expect.anything()
    );
  });

  // 其他方法的测试用例可以类似地编写，例如：
  // test('getEmbeddings 方法测试', async () => {...});
  // test('queuePrompt 方法测试', async () => {...});
  // ...

  // 注意：每个测试方法都应该独立于其他方法，因此在beforeEach中重置mock和实例。
});