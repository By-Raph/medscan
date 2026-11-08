const assert=require('assert'); const path=require('path').join(__dirname,'..')+'/';
const GS1=require(path+'js/gs1.js'); const RM=require(path+'js/regelmotor.js');
global.window={}; require(path+'data/regels.js'); require(path+'data/geneesmiddelen.js');
const R=window.MEDSCAN_REGELS, DB=window.MEDSCAN_DB;
// GS1
let r=GS1.parse('(01)05412345678908(17)270531(10)LOT42A(21)SN1234567890');
assert.equal(r.type,'gs1'); assert.equal(r.gtin,'05412345678908'); assert.equal(r.vervaldatum,'2027-05-31'); assert.equal(r.lot,'LOT42A'); assert.equal(r.serienummer,'SN1234567890'); assert.ok(r.gtinGeldig);
r=GS1.parse('01054123456789081727053110LOT42A\u001d21SN1234567890');
assert.equal(r.gtin,'05412345678908'); assert.equal(r.lot,'LOT42A'); assert.equal(r.serienummer,'SN1234567890');
r=GS1.parse(']d201054123456789081727053121SN1\u001d10LOT');
assert.equal(r.serienummer,'SN1'); assert.equal(r.lot,'LOT');
r=GS1.parse('(01)05412345678908(17)270500'); assert.equal(r.vervaldatum,'2027-05-31');
r=GS1.parse('5412345678908'); assert.equal(r.type,'ean'); assert.equal(r.gtin,'05412345678908');
r=GS1.parse('5412345678907'); assert.equal(r.type,'andere'); // foute checkdigit
assert.ok(GS1.isVervallen('2024-01-31')); assert.ok(!GS1.isVervallen('2099-01-01'));
// ATC check: alle merken verwijzen naar bestaande stoffen
DB.MERKEN.forEach(([m,st])=>st.forEach(s=>assert.ok(DB.STOFFEN[s], m+': '+s)));
Object.entries(DB.STOFFEN).forEach(([s,a])=>assert.match(a,/^[A-Z]\d\d[A-Z][A-Z]\d\d$/, s));
// Regels
const prod=(naam,...st)=>({naam, stoffen:st.map(s=>({naam:s, atc:DB.STOFFEN[s]}))});
let id=0; const it=(p,extra={})=>Object.assign({id:'i'+(++id), product:p, inname:'ja', schema:{o:1,m:0,a:0,s:0}},extra);
let items=[it(prod('Coversyl','perindopril')), it(prod('Aldactone','spironolacton'))];
let w=RM.evalueer(items,{},R); assert.equal(w.length,1); assert.equal(w[0].regelId,'hyperkaliemie'); assert.equal(w[0].ernst,'matig');
w=RM.evalueer(items,{egfr:30},R); assert.equal(w[0].ernst,'hoog');
items.push(it(prod('Brufen','ibuprofen'))); w=RM.evalueer(items,{},R);
assert.deepEqual(w.map(x=>x.regelId).sort(),['hyperkaliemie','triple-whammy']); assert.ok(w.every(x=>x.ernst==='hoog'));
items[2].inname='nee'; w=RM.evalueer(items,{},R); assert.deepEqual(w.map(x=>x.regelId),['hyperkaliemie']);
// dubbel
items=[it(prod('Pantomed','pantoprazol')), it(prod('Pantoprazol EG','pantoprazol')), it(prod('Nexiam','esomeprazol'))];
w=RM.evalueer(items,{},R); console.log(w.map(x=>[x.regelId,x.ernst,x.tekst]));
assert.ok(w.find(x=>x.regelId==='dubbel-gebruik')); assert.ok(w.find(x=>x.regelId==='dubbel-gebruik-klasse'));
// combinatiepreparaat splitst
items=[it(prod('Co-Diovane','valsartan','hydrochloorthiazide')), it(prod('Voltaren','diclofenac'))];
w=RM.evalueer(items,{},R); assert.ok(w.find(x=>x.regelId==='triple-whammy'));
// MTX
items=[it(prod('Ledertrexate','methotrexaat'))]; assert.equal(RM.evalueer(items,{},R)[0].regelId,'methotrexaat-dagelijks');
items[0].nietDagelijks='wekelijks'; assert.equal(RM.evalueer(items,{},R).length,0);
// vervallen
items=[it(prod('Dafalgan','paracetamol'),{vervallen:true,vervaldatum:'2024-01-31'})]; assert.equal(RM.evalueer(items,{},R)[0].regelId,'vervallen');
// SAM-databank (indien aanwezig)
try { require(path+'data/sam.js'); } catch(e) {}
const SAM=window.MEDSCAN_SAM;
if (SAM) {
  const sp=i=>{const p=SAM.producten[i]; return {naam:p[0], stoffen:p[2].map(x=>({naam:SAM.stoffen[x[0]][0], atc:SAM.stoffen[x[0]][1]||p[1]}))};};
  const fx=SAM.gtin['05000456017282']; assert.ok(fx!=null,'Forxiga-GTIN in SAM'); assert.match(sp(fx).naam,/Forxiga 10 mg/);
  const zoekNaam=re=>SAM.producten.findIndex(p=>re.test(p[0])&&p[3]===1);
  const cd=sp(zoekNaam(/^Co-Diovane 80/)); assert.deepEqual(cd.stoffen.map(s=>s.atc).sort(),['C03AA03','C09CA03']);
  const br=sp(zoekNaam(/^Brufen 400/));
  let w=RM.evalueer([it(cd),it(br)],{},R); assert.ok(w.find(x=>x.regelId==='triple-whammy'),'triple whammy met SAM-combinatie');
  const jm=sp(zoekNaam(/^Janumet 50 mg - 850/)); assert.deepEqual(jm.stoffen.map(s=>s.atc).sort(),['A10BA02','A10BH01']);
  console.log('SAM OK:', SAM.versie, Object.keys(SAM.gtin).length, 'GTIN');
}
console.log('ALLE TESTS OK; stoffen:',Object.keys(DB.STOFFEN).length,'merken:',DB.MERKEN.length);
