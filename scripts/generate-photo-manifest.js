const fs = require('fs');
const path = require('path');

const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const photoDirs = ['home_photos', 'about_photos'];

photoDirs.forEach(dir => {
  const photosDir = path.join(__dirname, '..', 'public', dir);

  if (!fs.existsSync(photosDir)) {
    console.log(`Skipping ${dir}: directory not found`);
    return;
  }

  const files = fs.readdirSync(photosDir)
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext) && file !== 'manifest.json';
    })
    .sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    })
    .map(file => `/${dir}/${file}`);

  const outputPath = path.join(photosDir, 'manifest.json');
  fs.writeFileSync(outputPath, JSON.stringify(files, null, 2));
  console.log(`${dir}/manifest.json: ${files.length} photos found`);
});
