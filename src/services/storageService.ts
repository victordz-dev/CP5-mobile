import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app from './firebase';

export const storage = getStorage(app);

export const uploadImageAsync = async (uri: string, path: string): Promise<string> => {
  const blob: Blob = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function (e) {
      console.log(e);
      reject(new TypeError('Network request failed'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });

  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob);

  // We're done with the blob, close and release it
  (blob as unknown as { close: () => void }).close();

  return await getDownloadURL(fileRef);
};
