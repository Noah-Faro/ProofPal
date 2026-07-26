import { prepareImageForApi } from '../imageHelper';
import { ProofPalError } from '../../types/proof';

const mockBase64 = jest.fn<Promise<string>, []>();
const mockFileSize = new Map<string, number>();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    size: mockFileSize.get(uri) ?? 0,
    base64: mockBase64,
  })),
}));

describe('prepareImageForApi', () => {
  beforeEach(() => {
    mockBase64.mockReset();
    mockFileSize.clear();
  });

  it('parses supported image data URIs without filesystem access', async () => {
    await expect(prepareImageForApi('data:image/png;base64,aGVsbG8=')).resolves.toEqual({
      data: 'aGVsbG8=',
      mimeType: 'image/png',
    });
    expect(mockBase64).not.toHaveBeenCalled();
  });

  it('preserves a picked image MIME type when reading through Expo File', async () => {
    mockBase64.mockResolvedValue('aGVsbG8=');

    await expect(prepareImageForApi({
      uri: 'file:///proof.heic',
      name: 'proof.heic',
      mimeType: 'image/heic',
      size: 5,
    })).resolves.toEqual({ data: 'aGVsbG8=', mimeType: 'image/heic' });
    expect(mockBase64).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported formats before reading them', async () => {
    await expect(prepareImageForApi({
      uri: 'file:///proof.gif',
      name: 'proof.gif',
      mimeType: 'image/gif',
    })).rejects.toMatchObject<Partial<ProofPalError>>({ code: 'UNSUPPORTED_FILE' });
    expect(mockBase64).not.toHaveBeenCalled();
  });

  it('rejects an image whose known size exceeds the inline limit', async () => {
    await expect(prepareImageForApi({
      uri: 'file:///large.jpg',
      name: 'large.jpg',
      mimeType: 'image/jpeg',
      size: 14 * 1024 * 1024 + 1,
    })).rejects.toMatchObject<Partial<ProofPalError>>({ code: 'FILE_TOO_LARGE' });
    expect(mockBase64).not.toHaveBeenCalled();
  });
});
