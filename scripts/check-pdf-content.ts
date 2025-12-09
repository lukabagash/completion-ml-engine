import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';

async function checkPDF() {
  const pdfPath = path.join(__dirname, '../pdf_mock_agreements/orion_agreement.pdf');
  const pdfBuffer = fs.readFileSync(pdfPath);
  
  const data = await pdf(pdfBuffer);
  const text = data.text;
  
  // Find section 3.2
  const idx = text.indexOf('3.2');
  if (idx > -1) {
    console.log(text.substring(idx, idx + 500));
  } else {
    console.log('3.2 not found');
  }
  
  // Also search for Daniel
  if (text.includes('Daniel')) {
    const didx = text.indexOf('Daniel');
    console.log('\n\nDaniel found at:');
    console.log(text.substring(didx - 50, didx + 150));
  } else {
    console.log('\n\nDaniel NOT found in PDF');
  }
}

checkPDF().catch(console.error);
