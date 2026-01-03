import fs from 'fs/promises';
import jspath from 'path';

async function checkIsFolder(path: string) {
  try {
    const stat = await fs.stat(path);
    return stat.isDirectory();
  } catch (error) {
    return false;
  }
}

async function checkIsFile(path: string) {
  const stat = await fs.stat(path);
  return [stat.isFile(), stat.size] as [boolean, number];
}

function validateFlags() {
  // provided valid flag
  const srcIndex = process.argv.findIndex(flag => flag.startsWith('--src='));
  const hasSrc = srcIndex !== -1;
  if (!hasSrc) {
    throw Error('You must provide --src=<source>');
  }
  const destIndex = process.argv.findIndex(flag => flag.startsWith('--dest='));
  const hasDest = destIndex !== -1;
  if (!hasDest) {
    throw Error('You must provide --dest=<destionation>');
  }
  // Check if dir is valid
  const dir = process.argv[srcIndex]?.split('=')[1] as string;
  const dest = process.argv[destIndex]?.split('=')[1] as string;
  return {
    dir,
    dest,
  };
}

type FileLocation = {
  path: string; fileName: string; fileSize: number;
}

const fileLocations: FileLocation[] = [];

async function checkIsMedia(path: string) {
  const fileExtension = path.split('.').at(-1)?.toLowerCase();
  const validMedia = ['jpg', 'png', 'heic', 'mp4', 'jpeg', 'mov'];
  const isValidMedia = validMedia.findIndex(extension => {
    return extension === fileExtension;
  }) !== -1;
  return isValidMedia;
}

function logStatus() {
  console.clear();
  console.log('Generating list of files', fileLocations.length);
}

function chunkArray<T>(array: T[], size: number) {
  const results = [];
  let i = 0;
  while (i < array.length) {
    results.push(array.slice(i, i + size));
    i += size;
  }
  return results;
}

async function updateLocations(path: string) {
  logStatus();
  const files = await fs.readdir(path);
  const chunkedFiles = chunkArray<string>(files, 10);
  for (let items of chunkedFiles) {
    await Promise.all(items.map(async (file) => {
      const filePath = jspath.join(path, file);
      const [isFile, fileSize] = await checkIsFile(filePath);
      const isMedia = await checkIsMedia(filePath);
      if (isFile && isMedia) {
        fileLocations.push({ path: filePath, fileName: file, fileSize });
      }
      const isFolder = await checkIsFolder(filePath);
      if (isFolder) {
        await updateLocations(filePath);
      }
    }));
    logStatus();
  }
}

async function copyFileRetry(srcPath: string, destPath: string, retryAttempts: number, delay: number) {
  for (let i = 0; i < retryAttempts; i++) {
    try {
      await fs.copyFile(srcPath, destPath);
      return;
    } catch (error) {
      const isLastAttempt = i === retryAttempts - 1;
      if (!isLastAttempt) {
        await new Promise((res) => setTimeout(res, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

async function init() {
  try {
    // Generate list of files
    logStatus();
    const { dir, dest } = validateFlags();
    const path = jspath.join(process.cwd(), dir!);
    const destination = jspath.join(process.cwd(), dest!);
    await updateLocations(path);
    console.log('Saving to file');
    await fs.writeFile('./files.json', JSON.stringify(fileLocations));
    console.log('Copying files to location');
    const batchFileLocations = chunkArray(fileLocations, 10_000);
    for (let [index, files] of batchFileLocations.entries()) {
      const chunkedFiles = chunkArray(files, 10);
      const directoryLocation = jspath.join(destination, (index + 1).toString());
      const hasDirectoryLocation = checkIsFolder(directoryLocation);
      if (!hasDirectoryLocation) {
        await fs.mkdir(directoryLocation);
      }
      for (let files of chunkedFiles) {
        await Promise.all(files.map(async file => {
          await copyFileRetry(file.path, jspath.join(directoryLocation, file.fileName), 3, 100);
        }))
      }
      console.clear();
      console.log(`Copying files ${index + 1}/${fileLocations.length}`);
    }
  } catch (error) {
    console.error('ERROR - init():', error);
    process.exit();
  }
}

init();
