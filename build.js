const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔨 Building distribution files...\n');

const distDir = path.join(__dirname, 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log('✓ Created dist/ directory');
}

// Create dist/public directory if it doesn't exist
const publicDistDir = path.join(distDir, 'public');
if (!fs.existsSync(publicDistDir)) {
    fs.mkdirSync(publicDistDir, { recursive: true });
    console.log('✓ Created dist/public/ directory');
}

// Create dist/public/css and dist/public/js directories
const cssDistDir = path.join(publicDistDir, 'css');
const jsDistDir = path.join(publicDistDir, 'js');
if (!fs.existsSync(cssDistDir)) {
    fs.mkdirSync(cssDistDir, { recursive: true });
}
if (!fs.existsSync(jsDistDir)) {
    fs.mkdirSync(jsDistDir, { recursive: true });
}

// Generate content hash for a file
function generateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

// Copy file with hash and return the hashed filename (without updating content yet)
function copyWithHash(sourcePath, destDir, filename) {
    const content = fs.readFileSync(sourcePath);
    const hash = generateHash(content);
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const hashedFilename = `${baseName}.${hash}${ext}`;
    
    return { hashedFilename, content, hash };
}

// Process CSS and JS files with hashing
const cssFiles = {
    'public/css/styles.css': 'css',
    'public/css/disclaimer.css': 'css'
};

const jsFiles = {
    'public/js/config.js': 'js',
    'public/js/facts.js': 'js',
    'public/js/api.js': 'js',
    'public/js/ui.js': 'js',
    'public/js/chat.js': 'js',
    'public/js/rating.js': 'js',
    'public/js/disclaimer.js': 'js',
    'public/js/main.js': 'js'
};

const hashedFiles = {};
const fileContents = {};

// Step 1: Read all files and generate hashes
console.log('\n📦 Processing CSS files:');
Object.keys(cssFiles).forEach(filePath => {
    const sourcePath = path.join(__dirname, filePath);
    const filename = path.basename(filePath);
    const destSubdir = cssFiles[filePath];
    
    if (fs.existsSync(sourcePath)) {
        const { hashedFilename, content } = copyWithHash(sourcePath, null, filename);
        const originalPath = `${destSubdir}/${filename}`;
        const hashedPath = `${destSubdir}/${hashedFilename}`;
        
        hashedFiles[originalPath] = hashedPath;
        fileContents[hashedPath] = content;
        
        console.log(`✓ Hashed ${filename} → ${hashedFilename}`);
    } else {
        console.log(`✗ Missing required file: ${filePath}`);
        process.exit(1);
    }
});

console.log('\n📦 Processing JS files:');
Object.keys(jsFiles).forEach(filePath => {
    const sourcePath = path.join(__dirname, filePath);
    const filename = path.basename(filePath);
    const destSubdir = jsFiles[filePath];
    
    if (fs.existsSync(sourcePath)) {
        const { hashedFilename, content } = copyWithHash(sourcePath, null, filename);
        const originalPath = `${destSubdir}/${filename}`;
        const hashedPath = `${destSubdir}/${hashedFilename}`;
        
        hashedFiles[originalPath] = hashedPath;
        fileContents[hashedPath] = content;
        
        console.log(`✓ Hashed ${filename} → ${hashedFilename}`);
    } else {
        console.log(`✗ Missing required file: ${filePath}`);
        process.exit(1);
    }
});

// Step 2: Update import statements in JS files
console.log('\n🔄 Updating import statements in JS files:');
Object.keys(fileContents).forEach(filePath => {
    if (filePath.endsWith('.js')) {
        let content = fileContents[filePath].toString();
        let updated = false;
        
        // Replace import statements
        Object.keys(hashedFiles).forEach(original => {
            const hashed = hashedFiles[original];
            const originalFilename = original.split('/').pop();
            const hashedFilename = hashed.split('/').pop();
            
            // Update import statements: from './config.js' to './config.77794265.js'
            const importPattern = new RegExp(`from\\s+['"]\\.\\/([^'"]+)['"]`, 'g');
            // Also update dynamic imports: import('./config.js') to import('./config.77794265.js')
            const dynamicImportPattern = new RegExp(`import\\(\\s*['"]\\.\\/([^'"]+)['"]`, 'g');
            // Update static imports
            const newContent = content.replace(importPattern, (match, importPath) => {
                const importFile = importPath.split('/').pop();
                if (importFile === originalFilename) {
                    updated = true;
                    return match.replace(originalFilename, hashedFilename);
                }
                return match;
            });

            // Update dynamic imports
            const newContent2 = newContent.replace(dynamicImportPattern, (match, importPath) => {
                const importFile = importPath.split('/').pop();
                if (importFile === originalFilename) {
                    updated = true;
                    return match.replace(originalFilename, hashedFilename);
                }
                return match;
            });

            content = newContent2;
        });
        
        fileContents[filePath] = content;
        if (updated) {
            console.log(`✓ Updated imports in ${filePath.split('/').pop()}`);
        }
    }
});

// Step 3: Write all files to disk
console.log('\n💾 Writing files to dist:');
Object.keys(fileContents).forEach(filePath => {
    const destPath = path.join(publicDistDir, filePath);
    const destDir = path.dirname(destPath);
    
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.writeFileSync(destPath, fileContents[filePath]);
    console.log(`✓ Wrote ${filePath}`);
});

// Process index.html with hashed references
console.log('\n📝 Processing HTML:');
const htmlSourcePath = path.join(__dirname, 'public/index.html');
let htmlContent = fs.readFileSync(htmlSourcePath, 'utf8');

// Replace CSS references
Object.keys(hashedFiles).forEach(original => {
    const hashed = hashedFiles[original];
    htmlContent = htmlContent.replace(
        new RegExp(`href="${original}"`, 'g'),
        `href="${hashed}"`
    );
    htmlContent = htmlContent.replace(
        new RegExp(`src="${original}"`, 'g'),
        `src="${hashed}"`
    );
});

// Write processed HTML
const htmlDestPath = path.join(publicDistDir, 'index.html');
fs.writeFileSync(htmlDestPath, htmlContent);
console.log('✓ Processed index.html with hashed references');

// Copy other required files
console.log('\n📦 Copying other files:');
const otherFiles = [
    { from: 'server.js', to: 'server.js' },
    { from: 'package.json', to: 'package.json' },
    { from: 'package-lock.json', to: 'package-lock.json' },
    { from: 'ecosystem.config.js', to: 'ecosystem.config.js' },
    { from: '.htaccess', to: '.htaccess', optional: true }
];

// Copy PDFs to their proper subdirectories (for document registry system)
console.log('\n📄 Copying PDF files to registry structure:');
const pdfFiles = [
    { from: 'PDFs/manuals/smh-manual-2023.pdf', to: 'PDFs/manuals/smh-manual-2023.pdf' },
    { from: 'PDFs/manuals/uhn-manual-2025.pdf', to: 'PDFs/manuals/uhn-manual-2025.pdf' },
    { from: 'PDFs/manuals/Kidney-Transplant-Medications-Tip-Sheet-Aug-2024.pdf', to: 'PDFs/manuals/Kidney-Transplant-Medications-Tip-Sheet-Aug-2024.pdf' },
    { from: 'PDFs/manuals/EPIC in the ICU at SMH_Trainees.pdf', to: 'PDFs/manuals/EPIC in the ICU at SMH_Trainees.pdf' },
    { from: 'PDFs/guidelines/PIIS1499267125000206.pdf', to: 'PDFs/guidelines/PIIS1499267125000206.pdf' },
    { from: 'PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf', to: 'PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf' },
    { from: 'PDFs/guidelines/KDIGO-2021-BP-GL.pdf', to: 'PDFs/guidelines/KDIGO-2021-BP-GL.pdf' },
    { from: 'PDFs/guidelines/KDIGO-2024-ANCA-Vasculitis-Guideline-Update.pdf', to: 'PDFs/guidelines/KDIGO-2024-ANCA-Vasculitis-Guideline-Update.pdf' },
    { from: 'PDFs/guidelines/KDIGO-2024-CKD-Guideline.pdf', to: 'PDFs/guidelines/KDIGO-2024-CKD-Guideline.pdf' },
    { from: 'PDFs/guidelines/KDIGO-2025-IgAN-IgAV-Guideline.pdf', to: 'PDFs/guidelines/KDIGO-2025-IgAN-IgAV-Guideline.pdf' },
    { from: 'PDFs/guidelines/KDIGO-2021-Glomerular-Diseases-Guideline_English_2024-Chapter-Updates.pdf', to: 'PDFs/guidelines/KDIGO-2021-Glomerular-Diseases-Guideline_English_2024-Chapter-Updates.pdf' },
    { from: 'PDFs/guidelines/KDIGO-2009-Transplant-Recipient-Guideline-English.pdf', to: 'PDFs/guidelines/KDIGO-2009-Transplant-Recipient-Guideline-English.pdf' },
    { from: 'PDFs/guidelines/KDIGO-Txp-Candidate-GL-FINAL.pdf', to: 'PDFs/guidelines/KDIGO-Txp-Candidate-GL-FINAL.pdf' },
    { from: 'PDFs/guidelines/KDIGO-2025-Guideline-for-Nephrotic-Syndrome-in-Children.pdf', to: 'PDFs/guidelines/KDIGO-2025-Guideline-for-Nephrotic-Syndrome-in-Children.pdf' },
    { from: 'PDFs/guidelines/2017-KDIGO-LD-GL.pdf', to: 'PDFs/guidelines/2017-KDIGO-LD-GL.pdf' },
    { from: 'PDFs/books/Fluid-Electrolyte-and-Acid-Base-Physiology-Kamel-Halperin.pdf', to: 'PDFs/books/Fluid-Electrolyte-and-Acid-Base-Physiology-Kamel-Halperin.pdf' },
    { from: 'PDFs/maker/FOH-TRAINING-GUIDE-MAY-2023.pdf', to: 'PDFs/maker/FOH-TRAINING-GUIDE-MAY-2023.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Magnesium-Disorders--Core-Curriculum-2024_2024_yaj.pdf', to: 'PDFs/ajkd-core-curriculum/Magnesium-Disorders--Core-Curriculum-2024_2024_yaj.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Management-of-Acute-Kidney-Injury--Core-Curriculum.pdf', to: 'PDFs/ajkd-core-curriculum/Management-of-Acute-Kidney-Injury--Core-Curriculum.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Management-of-Diabetes-Mellitus-in-Patients-With-C.pdf', to: 'PDFs/ajkd-core-curriculum/Management-of-Diabetes-Mellitus-in-Patients-With-C.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Management-of-Heart-Failure-in-Advancing-CKD--Core.pdf', to: 'PDFs/ajkd-core-curriculum/Management-of-Heart-Failure-in-Advancing-CKD--Core.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/ANCA-Associated-Vasculitis--Core-Curriculum-2020_2.pdf', to: 'PDFs/ajkd-core-curriculum/ANCA-Associated-Vasculitis--Core-Curriculum-2020_2.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Approach-to-Diagnosis-and-Management-of-Primary-Gl.pdf', to: 'PDFs/ajkd-core-curriculum/Approach-to-Diagnosis-and-Management-of-Primary-Gl.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Approach-to-Kidney-Biopsy--Core-Curriculum-2022_20.pdf', to: 'PDFs/ajkd-core-curriculum/Approach-to-Kidney-Biopsy--Core-Curriculum-2022_20.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Approach-to-Patients-With-High-Anion-Gap-Metabolic.pdf', to: 'PDFs/ajkd-core-curriculum/Approach-to-Patients-With-High-Anion-Gap-Metabolic.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Autosomal-Dominant-Polycystic-Kidney-Disease--Core.pdf', to: 'PDFs/ajkd-core-curriculum/Autosomal-Dominant-Polycystic-Kidney-Disease--Core.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Biomarkers-in-Nephrology--Core-Curriculum-2013_201.pdf', to: 'PDFs/ajkd-core-curriculum/Biomarkers-in-Nephrology--Core-Curriculum-2013_201.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/CKD&#x2013;Mineral-and-Bone-Disorder--Core-Curricu.pdf', to: 'PDFs/ajkd-core-curriculum/CKD&#x2013;Mineral-and-Bone-Disorder--Core-Curricu.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Calcium-and-Phosphate-Disorders--Core-Curriculum-2.pdf', to: 'PDFs/ajkd-core-curriculum/Calcium-and-Phosphate-Disorders--Core-Curriculum-2.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Cardiovascular-Disease-and-CKD--Core-Curriculum-20.pdf', to: 'PDFs/ajkd-core-curriculum/Cardiovascular-Disease-and-CKD--Core-Curriculum-20.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Clinical-Genetic-Testing-in-Nephrology--Core-Curri.pdf', to: 'PDFs/ajkd-core-curriculum/Clinical-Genetic-Testing-in-Nephrology--Core-Curri.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Concomitant-Lung-and-Kidney-Disorders-in-Criticall.pdf', to: 'PDFs/ajkd-core-curriculum/Concomitant-Lung-and-Kidney-Disorders-in-Criticall.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Continuous-Dialysis-Therapies--Core-Curriculum-201.pdf', to: 'PDFs/ajkd-core-curriculum/Continuous-Dialysis-Therapies--Core-Curriculum-201.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Critical-Care-Nephrology--Core-Curriculum-2009_200.pdf', to: 'PDFs/ajkd-core-curriculum/Critical-Care-Nephrology--Core-Curriculum-2009_200.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Critical-Care-Nephrology--Core-Curriculum-2020_202.pdf', to: 'PDFs/ajkd-core-curriculum/Critical-Care-Nephrology--Core-Curriculum-2020_202.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Dermatological-Disease-in-Patients-With-CKD_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Dermatological-Disease-in-Patients-With-CKD_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Development-of-Clinical-Practice-Guidelines-in-the.pdf', to: 'PDFs/ajkd-core-curriculum/Development-of-Clinical-Practice-Guidelines-in-the.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Diagnosis-and-Management-of-Disorders-of-Body-Toni.pdf', to: 'PDFs/ajkd-core-curriculum/Diagnosis-and-Management-of-Disorders-of-Body-Toni.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Diagnosis-and-Management-of-Renal-Cystic-Disease-o.pdf', to: 'PDFs/ajkd-core-curriculum/Diagnosis-and-Management-of-Renal-Cystic-Disease-o.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Diuretics-in-States-of-Volume-Overload--Core-Curri.pdf', to: 'PDFs/ajkd-core-curriculum/Diuretics-in-States-of-Volume-Overload--Core-Curri.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Dysproteinemia-and-the-Kidney--Core-Curriculum-201.pdf', to: 'PDFs/ajkd-core-curriculum/Dysproteinemia-and-the-Kidney--Core-Curriculum-201.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Economic-Factors-in-Nephrology--Core-Curriculum-20.pdf', to: 'PDFs/ajkd-core-curriculum/Economic-Factors-in-Nephrology--Core-Curriculum-20.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Evaluation-and-Management-of-Resistant-Hypertensio.pdf', to: 'PDFs/ajkd-core-curriculum/Evaluation-and-Management-of-Resistant-Hypertensio.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Evaluation-of-Adult-Kidney-Transplant-Candidates_y.pdf', to: 'PDFs/ajkd-core-curriculum/Evaluation-of-Adult-Kidney-Transplant-Candidates_y.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Evaluation-of-Kidney-Donors--Core-Curriculum-2018_.pdf', to: 'PDFs/ajkd-core-curriculum/Evaluation-of-Kidney-Donors--Core-Curriculum-2018_.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Evaluation-of-the-Potential-Living-Kidney-Donor_20.pdf', to: 'PDFs/ajkd-core-curriculum/Evaluation-of-the-Potential-Living-Kidney-Donor_20.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Fluid-Management-in-Adults-and-Children--Core-Curr.pdf', to: 'PDFs/ajkd-core-curriculum/Fluid-Management-in-Adults-and-Children--Core-Curr.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/General-Medical-Care-of-the-Dialysis-Patient--Core.pdf', to: 'PDFs/ajkd-core-curriculum/General-Medical-Care-of-the-Dialysis-Patient--Core.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Genetic-Investigations-of-Kidney-Disease--Core-Cur.pdf', to: 'PDFs/ajkd-core-curriculum/Genetic-Investigations-of-Kidney-Disease--Core-Cur.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Genetics-of-Nephrotic-Syndrome-Presenting-in-Child.pdf', to: 'PDFs/ajkd-core-curriculum/Genetics-of-Nephrotic-Syndrome-Presenting-in-Child.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Glomerular-Diseases-Dependent-on-Complement-Activa.pdf', to: 'PDFs/ajkd-core-curriculum/Glomerular-Diseases-Dependent-on-Complement-Activa.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Health-Policy-and-Kidney-Care-in-the-United-States.pdf', to: 'PDFs/ajkd-core-curriculum/Health-Policy-and-Kidney-Care-in-the-United-States.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Hemodialysis--Core-Curriculum-2014_2013_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Hemodialysis--Core-Curriculum-2014_2013_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Hemodialysis-Emergencies--Core-Curriculum-2021_202.pdf', to: 'PDFs/ajkd-core-curriculum/Hemodialysis-Emergencies--Core-Curriculum-2021_202.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Home-Hemodialysis,-Daily-Hemodialysis,-and-Nocturn.pdf', to: 'PDFs/ajkd-core-curriculum/Home-Hemodialysis,-Daily-Hemodialysis,-and-Nocturn.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Home-Hemodialysis--Core-Curriculum-2021_2021_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Home-Hemodialysis--Core-Curriculum-2021_2021_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Hypertension-in-CKD--Core-Curriculum-2019_2019_yaj.pdf', to: 'PDFs/ajkd-core-curriculum/Hypertension-in-CKD--Core-Curriculum-2019_2019_yaj.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/IgA-Nephropathy--Core-Curriculum-2021_2021_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/IgA-Nephropathy--Core-Curriculum-2021_2021_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Infectious-Disease-Following-Kidney-Transplant--Co.pdf', to: 'PDFs/ajkd-core-curriculum/Infectious-Disease-Following-Kidney-Transplant--Co.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Interventional-Nephrology--Core-Curriculum-2009_20.pdf', to: 'PDFs/ajkd-core-curriculum/Interventional-Nephrology--Core-Curriculum-2009_20.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Kidney-Development--Core-Curriculum-2011_2011_yajk.pdf', to: 'PDFs/ajkd-core-curriculum/Kidney-Development--Core-Curriculum-2011_2011_yajk.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Kidney-Disease-in-the-Setting-of-Liver-Failure--Co.pdf', to: 'PDFs/ajkd-core-curriculum/Kidney-Disease-in-the-Setting-of-Liver-Failure--Co.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Kidney-Dysfunction-in-the-Setting-of-Liver-Failure.pdf', to: 'PDFs/ajkd-core-curriculum/Kidney-Dysfunction-in-the-Setting-of-Liver-Failure.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Kidney-Stone-Pathophysiology,-Evaluation-and-Manag.pdf', to: 'PDFs/ajkd-core-curriculum/Kidney-Stone-Pathophysiology,-Evaluation-and-Manag.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Kidney-Supportive-Care--Core-Curriculum-2020_2020_.pdf', to: 'PDFs/ajkd-core-curriculum/Kidney-Supportive-Care--Core-Curriculum-2020_2020_.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Laboratory-Anomalies-in-the-Basic-Metabolic-Panel-.pdf', to: 'PDFs/ajkd-core-curriculum/Laboratory-Anomalies-in-the-Basic-Metabolic-Panel-.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Management-of-Kidney-Transplant-Recipients-by-Gene.pdf', to: 'PDFs/ajkd-core-curriculum/Management-of-Kidney-Transplant-Recipients-by-Gene.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Management-of-Poisonings--Core-Curriculum-2010_201.pdf', to: 'PDFs/ajkd-core-curriculum/Management-of-Poisonings--Core-Curriculum-2010_201.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Management-of-the-Hemodialysis-Unit--Core-Curricul.pdf', to: 'PDFs/ajkd-core-curriculum/Management-of-the-Hemodialysis-Unit--Core-Curricul.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Measurement-and-Estimation-of-GFR-for-Use-in-Clini.pdf', to: 'PDFs/ajkd-core-curriculum/Measurement-and-Estimation-of-GFR-for-Use-in-Clini.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Membranous-Nephropathy--Core-Curriculum-2021_2021_.pdf', to: 'PDFs/ajkd-core-curriculum/Membranous-Nephropathy--Core-Curriculum-2021_2021_.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Metabolic-Acidosis-in-CKD--Core-Curriculum-2019_20.pdf', to: 'PDFs/ajkd-core-curriculum/Metabolic-Acidosis-in-CKD--Core-Curriculum-2019_20.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Metabolic-Alkalosis-Pathogenesis,-Diagnosis,-and-T.pdf', to: 'PDFs/ajkd-core-curriculum/Metabolic-Alkalosis-Pathogenesis,-Diagnosis,-and-T.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Nutrition-in-Kidney-Disease--Core-Curriculum-2022_.pdf', to: 'PDFs/ajkd-core-curriculum/Nutrition-in-Kidney-Disease--Core-Curriculum-2022_.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Nutritional-Considerations-in-Kidney-Disease--Core.pdf', to: 'PDFs/ajkd-core-curriculum/Nutritional-Considerations-in-Kidney-Disease--Core.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Onco-Nephrology--Core-Curriculum-2015_2015_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Onco-Nephrology--Core-Curriculum-2015_2015_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Onconephrology--Core-Curriculum-2023_2023_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Onconephrology--Core-Curriculum-2023_2023_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Pathophysiology-of-Renal-Tubular-Acidosis--Core-Cu.pdf', to: 'PDFs/ajkd-core-curriculum/Pathophysiology-of-Renal-Tubular-Acidosis--Core-Cu.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Patient-Safety-Issues-in-CKD--Core-Curriculum-2015.pdf', to: 'PDFs/ajkd-core-curriculum/Patient-Safety-Issues-in-CKD--Core-Curriculum-2015.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Performance-and-Interpretation-of-Sonography-in-th.pdf', to: 'PDFs/ajkd-core-curriculum/Performance-and-Interpretation-of-Sonography-in-th.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Peritoneal-Dialysis-Prescription-and-Adequacy-in-C.pdf', to: 'PDFs/ajkd-core-curriculum/Peritoneal-Dialysis-Prescription-and-Adequacy-in-C.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Person-Centered-Care-for-Older-Adults-With-Kidney-.pdf', to: 'PDFs/ajkd-core-curriculum/Person-Centered-Care-for-Older-Adults-With-Kidney-.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Physiology-and-Pathophysiology-of-Potassium-Homeos.pdf', to: 'PDFs/ajkd-core-curriculum/Physiology-and-Pathophysiology-of-Potassium-Homeos.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Podocyte-Disorders--Core-Curriculum-2011_2011_yajk.pdf', to: 'PDFs/ajkd-core-curriculum/Podocyte-Disorders--Core-Curriculum-2011_2011_yajk.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Principles-of-Immunosuppression-in-the-Management-.pdf', to: 'PDFs/ajkd-core-curriculum/Principles-of-Immunosuppression-in-the-Management-.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Principles-of-Kidney-Pharmacotherapy-for-the-Nephr.pdf', to: 'PDFs/ajkd-core-curriculum/Principles-of-Kidney-Pharmacotherapy-for-the-Nephr.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Reducing-Kidney-Function-Decline-in-Patients-With-.pdf', to: 'PDFs/ajkd-core-curriculum/Reducing-Kidney-Function-Decline-in-Patients-With-.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Renal-Disorders-in-Pregnancy--Core-Curriculum-2019.pdf', to: 'PDFs/ajkd-core-curriculum/Renal-Disorders-in-Pregnancy--Core-Curriculum-2019.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Renal-Imaging--Core-Curriculum-2019_2019_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Renal-Imaging--Core-Curriculum-2019_2019_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Resistant-Hypertension--Core-Curriculum-2008_2008_.pdf', to: 'PDFs/ajkd-core-curriculum/Resistant-Hypertension--Core-Curriculum-2008_2008_.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Respiratory-Acidosis-and-Respiratory-Alkalosis--Co.pdf', to: 'PDFs/ajkd-core-curriculum/Respiratory-Acidosis-and-Respiratory-Alkalosis--Co.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Targeting-Zero-Infections-in-the-Outpatient-Dialys.pdf', to: 'PDFs/ajkd-core-curriculum/Targeting-Zero-Infections-in-the-Outpatient-Dialys.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Telenephrology--An-Emerging-Platform-for-Deliverin.pdf', to: 'PDFs/ajkd-core-curriculum/Telenephrology--An-Emerging-Platform-for-Deliverin.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/The-Role-of-the-General-Nephrologist-in-Evaluating.pdf', to: 'PDFs/ajkd-core-curriculum/The-Role-of-the-General-Nephrologist-in-Evaluating.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/The-Role-of-the-Kidney-in-Disorders-of-Volume--Cor.pdf', to: 'PDFs/ajkd-core-curriculum/The-Role-of-the-Kidney-in-Disorders-of-Volume--Cor.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/The-Role-of-the-Nephrologist-in-Management-of-Pois.pdf', to: 'PDFs/ajkd-core-curriculum/The-Role-of-the-Nephrologist-in-Management-of-Pois.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Therapeutic-Plasma-Exchange--Core-Curriculum-2008_.pdf', to: 'PDFs/ajkd-core-curriculum/Therapeutic-Plasma-Exchange--Core-Curriculum-2008_.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Therapeutic-Plasma-Exchange--Core-Curriculum-2023_.pdf', to: 'PDFs/ajkd-core-curriculum/Therapeutic-Plasma-Exchange--Core-Curriculum-2023_.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Toxic-Nephropathies--Core-Curriculum-2010_2009_yaj.pdf', to: 'PDFs/ajkd-core-curriculum/Toxic-Nephropathies--Core-Curriculum-2010_2009_yaj.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Toxic-Nephropathies-of-the-Tubulointerstitium--Cor.pdf', to: 'PDFs/ajkd-core-curriculum/Toxic-Nephropathies-of-the-Tubulointerstitium--Cor.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Transplant-Immunology-and-Immunosuppression--Core-.pdf', to: 'PDFs/ajkd-core-curriculum/Transplant-Immunology-and-Immunosuppression--Core-.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Tubular-Transport--Core-Curriculum-2010_2010_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Tubular-Transport--Core-Curriculum-2010_2010_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Unique-Considerations-in-Renal-Replacement-Therapy.pdf', to: 'PDFs/ajkd-core-curriculum/Unique-Considerations-in-Renal-Replacement-Therapy.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Update-on-Anemia-in-ESRD-and-Earlier-Stages-of-CKD.pdf', to: 'PDFs/ajkd-core-curriculum/Update-on-Anemia-in-ESRD-and-Earlier-Stages-of-CKD.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Update-on-Diabetic-Nephropathy--Core-Curriculum-20.pdf', to: 'PDFs/ajkd-core-curriculum/Update-on-Diabetic-Nephropathy--Core-Curriculum-20.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Update-on-Lupus-Nephritis--Core-Curriculum-2020_20.pdf', to: 'PDFs/ajkd-core-curriculum/Update-on-Lupus-Nephritis--Core-Curriculum-2020_20.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Update-on-Nephrolithiasis--Core-Curriculum-2016_20.pdf', to: 'PDFs/ajkd-core-curriculum/Update-on-Nephrolithiasis--Core-Curriculum-2016_20.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Update-on-Peritoneal-Dialysis--Core-Curriculum-201.pdf', to: 'PDFs/ajkd-core-curriculum/Update-on-Peritoneal-Dialysis--Core-Curriculum-201.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Update-on-the-Native-Kidney-Biopsy--Core-Curriculu.pdf', to: 'PDFs/ajkd-core-curriculum/Update-on-the-Native-Kidney-Biopsy--Core-Curriculu.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Updates-on-Infectious-and-Other-Complications-in-P.pdf', to: 'PDFs/ajkd-core-curriculum/Updates-on-Infectious-and-Other-Complications-in-P.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Urinalysis--Core-Curriculum-2008_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Urinalysis--Core-Curriculum-2008_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Urinary-Diversion--Core-Curriculum-2021_2021_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Urinary-Diversion--Core-Curriculum-2021_2021_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Urinary-Tract-Infections--Core-Curriculum-2024_202.pdf', to: 'PDFs/ajkd-core-curriculum/Urinary-Tract-Infections--Core-Curriculum-2024_202.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Urine-Sediment-Examination-in-the-Diagnosis-and-Ma.pdf', to: 'PDFs/ajkd-core-curriculum/Urine-Sediment-Examination-in-the-Diagnosis-and-Ma.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Vascular-Access--Core-Curriculum-2008_2008_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Vascular-Access--Core-Curriculum-2008_2008_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Viral-Nephropathies--Core-Curriculum-2008_yajkd.pdf', to: 'PDFs/ajkd-core-curriculum/Viral-Nephropathies--Core-Curriculum-2008_yajkd.pdf' },
    { from: 'PDFs/ajkd-core-curriculum/Viral-Nephropathies--Core-Curriculum-2024_2024_yaj.pdf', to: 'PDFs/ajkd-core-curriculum/Viral-Nephropathies--Core-Curriculum-2024_2024_yaj.pdf' }
];

// Copy logos to public directory
console.log('\n🎨 Copying logo files:');
const logoFiles = [
    { from: 'public/logos/maker-logo.png', to: 'public/logos/maker-logo.png' },
    { from: 'public/logos/ukidney-logo.svg', to: 'public/logos/ukidney-logo.svg' }
];

// Copy lib directory (for local embeddings module)
console.log('\n📦 Copying lib directory:');
const libSourceDir = path.join(__dirname, 'lib');
const libDestDir = path.join(distDir, 'lib');
if (fs.existsSync(libSourceDir)) {
    if (!fs.existsSync(libDestDir)) {
        fs.mkdirSync(libDestDir, { recursive: true });
    }
    const libFiles = fs.readdirSync(libSourceDir);
    libFiles.forEach(file => {
        const sourcePath = path.join(libSourceDir, file);
        const destPath = path.join(libDestDir, file);
        if (fs.statSync(sourcePath).isFile()) {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`✓ Copied lib/${file}`);
        }
    });
} else {
    console.log('⊘ No lib directory found (optional)');
}

let copiedCount = 0;
let skippedCount = 0;

// Copy PDF files first to ensure directories exist
pdfFiles.forEach(file => {
    const sourcePath = path.join(__dirname, file.from);
    const destPath = path.join(distDir, file.to);

    if (fs.existsSync(sourcePath)) {
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.copyFileSync(sourcePath, destPath);
        console.log(`✓ Copied PDF ${file.from}`);
        copiedCount++;
    } else {
        console.log(`✗ Missing PDF file: ${file.from}`);
        process.exit(1);
    }
});

// Copy logo files
logoFiles.forEach(file => {
    const sourcePath = path.join(__dirname, file.from);
    const destPath = path.join(distDir, file.to);

    if (fs.existsSync(sourcePath)) {
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.copyFileSync(sourcePath, destPath);
        console.log(`✓ Copied logo ${file.from}`);
        copiedCount++;
    } else {
        console.log(`✗ Missing logo file: ${file.from}`);
        process.exit(1);
    }
});

otherFiles.forEach(file => {
    const sourcePath = path.join(__dirname, file.from);
    const destPath = path.join(distDir, file.to);
    
    if (fs.existsSync(sourcePath)) {
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✓ Copied ${file.from}`);
        copiedCount++;
    } else if (!file.optional) {
        console.log(`✗ Missing required file: ${file.from}`);
        process.exit(1);
    } else {
        console.log(`⊘ Skipped optional file: ${file.from}`);
        skippedCount++;
    }
});

console.log(`\n📦 Build complete!`);
console.log(`   - ${Object.keys(cssFiles).length} CSS files hashed and copied`);
console.log(`   - ${Object.keys(jsFiles).length} JS files hashed and copied`);
console.log(`   - 1 HTML file processed with hashed references`);
console.log(`   - ${pdfFiles.length} PDF files copied to registry structure`);
console.log(`   - ${logoFiles.length} logo files copied`);
console.log(`   - ${copiedCount - pdfFiles.length - logoFiles.length} other files copied`);
if (skippedCount > 0) {
    console.log(`   - ${skippedCount} optional files skipped`);
}
console.log(`   - Output: dist/\n`);
console.log('💡 Note: .env file must be manually copied to server (not included in build)');
console.log('💡 Run "npm install --production" in dist/ on the server');
console.log('💡 Cache busting enabled: File hashes will change when content changes\n');
