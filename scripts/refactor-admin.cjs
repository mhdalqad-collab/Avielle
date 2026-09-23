const fs = require('node:fs');
const ts = require('typescript');
const file = 'components/admin.tsx';
const source = fs.readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const admin = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'Admin');
const blocks=[];
function visit(node){
 if(ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken){
  const left=node.expression.left.getText(ast);
  let name=left==='path === "/admin"'?'AdminOverview':left==='path === "/admin/users"'?'AdminUsers':left==='path === "/admin/events"'?'AdminEvents':left.includes('includes(path)')&&left.includes('/admin/luxury')?'AdminInventory':left.includes('includes(path)')&&left.includes('/admin/claims')?'AdminClaims':left.includes('includes(path)')&&left.includes('/admin/payments')?'AdminFinancials':null;
  if(name){let body=node.expression.right;while(ts.isParenthesizedExpression(body))body=body.expression;blocks.push({start:node.expression.right.getStart(ast),end:node.expression.right.end,name,body:body.getText(ast),jsx:ts.isJsxElement(body)||ts.isJsxSelfClosingElement(body)||ts.isJsxFragment(body)});return;}
 }
 ts.forEachChild(node,visit);
}
visit(admin);
if(blocks.length!==6)throw new Error('Expected six admin screen sections, found '+blocks.length);
let result=source;
for(const block of blocks.slice().sort((a,b)=>b.start-a.start))result=result.slice(0,block.start)+`<${block.name} path={path}/>`+result.slice(block.end);
const dataStart=admin.body.statements[0].getStart(ast);
const titleStart=admin.body.statements.find(n=>n.getText(ast).startsWith('const title')).getStart(ast);
const data=source.slice(dataStart,titleStart);
result=result.slice(0,dataStart)+result.slice(titleStart);
result+='\nfunction useAdminData(){\n'+data+'return {state,mutate,busy,items,pending,claims,held};\n}\n';
for(const block of blocks)result+=`\nfunction ${block.name}({path}:{path:string}){\nconst {state,mutate,busy,items,pending,claims,held}=useAdminData();\nreturn <>${block.jsx?block.body:'{'+block.body+'}'}</>;\n}\n`;
fs.writeFileSync(file,result);
console.log('Extracted six focused admin screen components.');
