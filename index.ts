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
  return stat.isFile();
}

function validateFlags() {
  // provided valid flag
  const dirIndex = process.argv.findIndex(flag => flag.startsWith('--dir='));
  const hasDir = dirIndex !== -1;
  if (!hasDir) {
    throw Error('You must provide --dir=<directory>');
  }
  // Check if dir is valid
  const dir = process.argv[dirIndex]?.split('=')[1];
  return {
    dir,
  };
}

const fileLocations: string[] = [];

async function checkIsMedia(path: string) {
  const fileExtension = path.split('.').at(-1)?.toLowerCase();
  const validMedia = ['jpg', 'png', 'heic', 'mp4', 'jpeg', 'mov'];
  const isValidMedia = validMedia.findIndex(extension => {
    return extension === fileExtension;
  }) !== -1;
  return isValidMedia;
}

async function updateLocations(path: string) {
  const list = await fs.readdir(path);
  for (let name of list) {
    const item = jspath.join(path, name);
    const isFile = await checkIsFile(item);
    const isMedia = await checkIsMedia(item);
    if (isFile && isMedia) {
      fileLocations.push(item);
    }
    const isFolder = await checkIsFolder(item);
    if (isFolder) {
      await updateLocations(item);
    }
  }
}

async function init() {
  try {
    const { dir } = validateFlags();
    const path = jspath.join(process.cwd(), dir!);
    await updateLocations(path);
    fs.writeFile('./files.json', JSON.stringify(fileLocations));
  } catch (error) {
    console.error('ERROR - init():', error);
    process.exit();
  }
}

init();
