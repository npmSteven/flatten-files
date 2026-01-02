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
  const destIndex = process.argv.findIndex(flag => flag.startsWith('--dest='));
  const hasDest = dirIndex !== -1;
  if (!hasDest) {
    throw Error('You must provide --dest=<destionation>');
  }
  // Check if dir is valid
  const dir = process.argv[dirIndex]?.split('=')[1];
  const dest = process.argv[destIndex]?.split('=')[1];
  return {
    dir,
    dest,
  };
}

const fileLocations: { path: string; fileName: string }[] = [];

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

async function updateLocations(path: string) {
  logStatus();
  const list = await fs.readdir(path);
  for (let name of list) {
    const item = jspath.join(path, name);
    const isFile = await checkIsFile(item);
    const isMedia = await checkIsMedia(item);
    if (isFile && isMedia) {
      fileLocations.push({ path: item, fileName: name });
    }
    const isFolder = await checkIsFolder(item);
    if (isFolder) {
      await updateLocations(item);
    }
  }
  logStatus();
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
    for (let [index, file] of fileLocations.entries()) {
      await fs.copyFile(file.path, jspath.join(destination, file.fileName));
      console.clear();
      console.log(`(${index + 1}/${fileLocations.length}) Copying`, file.path, 'to', jspath.join(destination, file.fileName));
    }
  } catch (error) {
    console.error('ERROR - init():', error);
    process.exit();
  }
}

init();
