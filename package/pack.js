const path = require('path');

const { buildTs, rmDist, copy } = require('@astral/pack');

rmDist();

buildTs({
  releaseTag: process.env.RELEASE_TAG,
});

// перезаписывает локальный README глобальным
copy({
  sourcesDirPath: path.resolve('..'),
  targetPath: '.',
  files: ['README.md'],
});
