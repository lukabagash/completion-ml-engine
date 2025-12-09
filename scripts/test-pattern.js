const text = "represented by CTO John Doe, CFO Mark Miller, and Associate Brian Brown.";

// Simplified pattern
const pattern = /\b(CTO|CFO|Associate)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-zA-Z]+){0,2})(?=,|\.|;|$|\s+(?:and|or))/gi;

let match;
console.log('Testing pattern extraction:');
while((match = pattern.exec(text)) !== null) {
  console.log(`  ${match[1]} ${match[2]}`);
}
