export const config = {
  mediaType: '',
  size: 50,
  digest:
    'sha256:db5t678c2946ae8c52553519a93bf5bc09c2df3e7f48cfb28acb258c91c67ee1',
};

export const manifest = {
  schemaVersion: 2,
  mediaType: 'la',
  config,
  layers: [
    {
      mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip',
      digest: '',
      size: 50000,
    },
  ],
};

export const opt = {
  username: 'username',
  password: 'password',
  reqOptions: {},
};

const blob = Buffer.from('text');
export const layers = [
  {
    config,
    blob,
  },
];
