/**
 * syncStudents.ts
 * Sincroniza estudiantes del PDF oficial SIE 2026 con la DB.
 * - Estudiantes existentes (por CI o RUDE): actualiza rude, birthDate, gender, ci
 * - Estudiantes nuevos: los crea y asigna al curso correspondiente
 *
 * Uso LOCAL:
 *   npx ts-node src/scripts/syncStudents.ts
 *
 * Uso PRODUCCIÓN:
 *   $env:DATABASE_URL="postgresql://prod..."; npx ts-node src/scripts/syncStudents.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Mapeos ────────────────────────────────────────────────────────────────────
const MESES: Record<string, number> = {
  ene:1, feb:2, mar:3, abr:4, may:5, jun:6,
  jul:7, ago:8, set:9, sep:9, oct:10, nov:11, dic:12,
}

const GRADOS: Record<number, string> = {
  1:'PRIMERO', 2:'SEGUNDO', 3:'TERCERO', 4:'CUARTO', 5:'QUINTO', 6:'SEXTO',
}

// ── Funciones auxiliares ──────────────────────────────────────────────────────
function parseFecha(s: string): Date | null {
  // "9 de may. de 2014"  |  "9 de may de 2014"
  const m = s.match(/(\d+)\s+de\s+(\w+)\.?\s+de\s+(\d+)/)
  if (!m) return null
  const [, d, mes, y] = m
  const month = MESES[mes.toLowerCase().replace('.','')]
  if (!month) return null
  return new Date(parseInt(y), month - 1, parseInt(d))
}

function parseName(nombre: string) {
  const words = nombre.trim().split(/\s+/)
  if (words.length < 3) return { lastName: words[0] || '', firstName: words.slice(1).join(' ') }
  return {
    lastName:  words.slice(0, 2).join(' '),
    firstName: words.slice(2).join(' '),
  }
}

// ── Datos del PDF ─────────────────────────────────────────────────────────────
// { rude, ci, nombre, gender:'M'|'F', fecha, grade:1-6, parallel:'A'|'B'|'C' }
const PDF_STUDENTS = [
  // ── GRADO 1 · PARALELO A ──────────────────────────────────────────────────
  {rude:'419800212018007',ci:'16570888',nombre:'AJALLA ZURITA CRISTHOFER',gender:'M',fecha:'9 de may. de 2014',grade:1,parallel:'A'},
  {rude:'419800212018005',ci:'16570927',nombre:'AJALLA ZURITA JEFFERSON',gender:'M',fecha:'9 de may. de 2014',grade:1,parallel:'A'},
  {rude:'419800212018021',ci:'15055957',nombre:'ARTEAGA RUIZ LUZ ALEJANDRA',gender:'F',fecha:'21 de ago. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018099',ci:'15588041',nombre:'AVALOS VASQUEZ FRED JUNIOR',gender:'M',fecha:'19 de dic. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018012',ci:'13305762',nombre:'AYALA FERNANDEZ ANDY ALEJANDRO',gender:'M',fecha:'17 de jul. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018054',ci:'15745311',nombre:'BAIGORRIA PESSOA VENYAMIN AGUSTIN',gender:'M',fecha:'13 de dic. de 2013',grade:1,parallel:'A'},
  {rude:'519800322019061',ci:'14876296',nombre:'BARRIENTOS GALARZA GUILLERMO FELIPE',gender:'M',fecha:'21 de set. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018040',ci:'14725974',nombre:'CALLEJAS MARTINEZ IAN WILLIAN',gender:'M',fecha:'7 de oct. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018025',ci:'17144870',nombre:'CESPEDES DIAZ YARITZA',gender:'F',fecha:'10 de ene. de 2014',grade:1,parallel:'A'},
  {rude:'419800262019062',ci:'15155277',nombre:'CHAUQUE LINO RIHANA PATRICIA',gender:'F',fecha:'17 de nov. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018046',ci:'15410264',nombre:'CHOQUE RAPU DIANA ISABEL',gender:'F',fecha:'20 de ago. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018045',ci:'15595074',nombre:'CONDORI CUELLAR BRISNEY ARACELI',gender:'F',fecha:'22 de nov. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018071',ci:'14826157',nombre:'CRUZ CACERES BETSY ELIANA',gender:'F',fecha:'12 de set. de 2013',grade:1,parallel:'A'},
  {rude:'419800322019051',ci:'16160155',nombre:'ESCOBAR GUZMAN JHEFERSON ADIEL',gender:'M',fecha:'14 de may. de 2014',grade:1,parallel:'A'},
  {rude:'419800212018073',ci:'15627994',nombre:'FLORES ARANCIBIA DULCE AILEN',gender:'F',fecha:'5 de may. de 2014',grade:1,parallel:'A'},
  {rude:'419800312018047',ci:'15155240',nombre:'FLORES MARTINEZ LUCIANA NICOL',gender:'F',fecha:'29 de oct. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018017',ci:'16783402',nombre:'GARCIA CASTRO JUAN DAVID',gender:'M',fecha:'19 de dic. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018035',ci:'15776874',nombre:'HIPAMO MAMANI KEISSY ARACELY',gender:'F',fecha:'8 de ene. de 2014',grade:1,parallel:'A'},
  {rude:'419800212018010',ci:'15081648',nombre:'LIMON GOMEZ MIQUEAS SALEM',gender:'M',fecha:'27 de ene. de 2014',grade:1,parallel:'A'},
  {rude:'419800212018037',ci:'15033574',nombre:'LOVERA BALLESTEROS YHEICOR LOGAN',gender:'M',fecha:'25 de set. de 2013',grade:1,parallel:'A'},
  {rude:'419800302018038',ci:'14611534',nombre:'LUNA ZAMBRANA LEXY',gender:'F',fecha:'27 de jun. de 2014',grade:1,parallel:'A'},
  {rude:'419800172017002',ci:'14826029',nombre:'MAMANI SEVERICHE MAYERLIN',gender:'F',fecha:'17 de ene. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018060',ci:'15956336',nombre:'MATURANO LOPEZ AURORA CRISTAL',gender:'F',fecha:'25 de mar. de 2014',grade:1,parallel:'A'},
  {rude:'419800212018084',ci:'14395478',nombre:'MELGAR TORREZ YEUDIEL',gender:'M',fecha:'6 de jul. de 2013',grade:1,parallel:'A'},
  {rude:'419800312018016',ci:'15141671',nombre:'OROPEZA PEREZ JHON JAIRO',gender:'M',fecha:'17 de feb. de 2014',grade:1,parallel:'A'},
  {rude:'819100052018018',ci:'17147617',nombre:'ORTUÑO GARCIA AILYN',gender:'F',fecha:'11 de ene. de 2014',grade:1,parallel:'A'},
  {rude:'419800262019038',ci:'14497469',nombre:'POLANCO BARRIENTOS YHOSELIN',gender:'F',fecha:'23 de feb. de 2014',grade:1,parallel:'A'},
  {rude:'419800212018101',ci:'17564979',nombre:'RAMOS ABALOS SAMIR',gender:'M',fecha:'15 de jun. de 2012',grade:1,parallel:'A'},
  {rude:'419800212018082',ci:'15138261',nombre:'RODAS RODAS ARACELY MAITHE',gender:'F',fecha:'23 de abr. de 2014',grade:1,parallel:'A'},
  {rude:'419800212018059',ci:'14611210',nombre:'RODRIGUEZ ZURITA MATEO',gender:'M',fecha:'11 de set. de 2013',grade:1,parallel:'A'},
  {rude:'419800322019062',ci:'16554461',nombre:'ROJAS SERRUDO THIAGO ANTONY',gender:'M',fecha:'29 de jun. de 2014',grade:1,parallel:'A'},
  {rude:'419800212018011',ci:'15411879',nombre:'ROMERO CONTRERAS ANDERSON',gender:'M',fecha:'8 de set. de 2013',grade:1,parallel:'A'},
  {rude:'419800712018040',ci:'15280184',nombre:'VARGAS ROMAN HANNA BRITTANY',gender:'F',fecha:'10 de set. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018096',ci:'16377138',nombre:'VEDIA ARAMBURO GENESIS',gender:'F',fecha:'9 de nov. de 2013',grade:1,parallel:'A'},
  {rude:'419800212018069',ci:'16349938',nombre:'VILLARRUBIA RIVADENEIRA ANABEL',gender:'F',fecha:'26 de may. de 2014',grade:1,parallel:'A'},
  {rude:'419800212019002',ci:'13403467',nombre:'ZABALA ROBLES GARY ZADID',gender:'M',fecha:'27 de feb. de 2014',grade:1,parallel:'A'},
  // ── GRADO 1 · PARALELO B ──────────────────────────────────────────────────
  {rude:'419800212018041',ci:'16324664',nombre:'ARCE GARCIA BRIANA MILENDY',gender:'F',fecha:'16 de ene. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018044',ci:'15729625',nombre:'AVILA NEGRETE ALEXIA MISHEL',gender:'F',fecha:'15 de abr. de 2014',grade:1,parallel:'B'},
  {rude:'419800312019050',ci:'17058703',nombre:'BALLESTEROS RODRIGUEZ YOHANA',gender:'F',fecha:'28 de may. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018103',ci:'14611505',nombre:'BARAHONA CRUZ DANIELA',gender:'F',fecha:'5 de jun. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018097',ci:'13743711',nombre:'BONILLA GARCIA ITZEL ZHARITH',gender:'F',fecha:'25 de ene. de 2014',grade:1,parallel:'B'},
  {rude:'4198002620229190',ci:'17574504',nombre:'CHICCHI DIAZ JUAN IGNACIO',gender:'M',fecha:'22 de abr. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018048',ci:'14030121',nombre:'CORREA VARGAS LUCIANA ISABEL',gender:'F',fecha:'20 de feb. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018049',ci:'15597837',nombre:'DURAN MIRANDA DANNA MASIEL',gender:'F',fecha:'26 de dic. de 2013',grade:1,parallel:'B'},
  {rude:'419800212018015',ci:'15553766',nombre:'ESCOBAR GUZMAN AXEL GAEL',gender:'M',fecha:'12 de may. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018033',ci:'14605187',nombre:'ESCRIVA ROJAS BENYAMIN ALEXI',gender:'M',fecha:'15 de nov. de 2013',grade:1,parallel:'B'},
  {rude:'819813182018027',ci:'16022486',nombre:'FERNANDEZ LLANOS DEISI',gender:'F',fecha:'16 de ene. de 2013',grade:1,parallel:'B'},
  {rude:'419800212018068',ci:'15505779',nombre:'FLORES LLAVETA ANYHELI NAITD',gender:'F',fecha:'11 de nov. de 2013',grade:1,parallel:'B'},
  {rude:'4198006520188279',ci:'16358852',nombre:'FLORES ESCOBAR SARAHY',gender:'F',fecha:'31 de ago. de 2013',grade:1,parallel:'B'},
  {rude:'419800212018086',ci:'16751122',nombre:'GOMEZ CUCHALLO UZIAS URIEL',gender:'M',fecha:'7 de ago. de 2013',grade:1,parallel:'B'},
  {rude:'419801072019010',ci:'14973384',nombre:'GONZALES CASTRO VALERIA',gender:'F',fecha:'8 de jun. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018087',ci:'15639564',nombre:'IPORRE QUISPE THIAGO ALEXANDER',gender:'M',fecha:'11 de abr. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018043',ci:'14100038',nombre:'LOVERA FIGUEROA KEILY',gender:'F',fecha:'23 de ene. de 2014',grade:1,parallel:'B'},
  {rude:'419800912018033',ci:'14100192',nombre:'MAMANI BURGOS LITZY AYME',gender:'F',fecha:'20 de ago. de 2013',grade:1,parallel:'B'},
  {rude:'419800262019009',ci:'14826911',nombre:'MENDOZA CABRERA JAIRO',gender:'M',fecha:'11 de jul. de 2013',grade:1,parallel:'B'},
  {rude:'419800212018080',ci:'16764380',nombre:'MOLINA SILES GENESIS',gender:'F',fecha:'7 de dic. de 2013',grade:1,parallel:'B'},
  {rude:'818900742018014',ci:'15837378',nombre:'MORALES TICONA DARIELY',gender:'F',fecha:'15 de ago. de 2013',grade:1,parallel:'B'},
  {rude:'419800212018029',ci:'15147171',nombre:'OVANDO TORREZ YOLANDA',gender:'F',fecha:'27 de feb. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018018',ci:'14604047',nombre:'PADILLA REYES THIAGO MAURICIO',gender:'M',fecha:'11 de ene. de 2014',grade:1,parallel:'B'},
  {rude:'419800142018004',ci:'14502965',nombre:'PALACIO SOLIZ NICOL YULIZA',gender:'F',fecha:'16 de nov. de 2013',grade:1,parallel:'B'},
  {rude:'419800212018092',ci:'14605223',nombre:'PEINADO MOJICA RUTH ANTONELLA',gender:'F',fecha:'19 de oct. de 2013',grade:1,parallel:'B'},
  {rude:'419800212018094',ci:'14604158',nombre:'PEINADO MOJICA SARA TIFFANY',gender:'F',fecha:'19 de oct. de 2013',grade:1,parallel:'B'},
  {rude:'419800712019007',ci:'16739948',nombre:'PINTO MAMANI MARIA GENESIS',gender:'F',fecha:'9 de nov. de 2013',grade:1,parallel:'B'},
  {rude:'419800212018028',ci:'16318115',nombre:'RAMIREZ COLQUE FRANCI MARELY',gender:'F',fecha:'24 de jul. de 2013',grade:1,parallel:'B'},
  {rude:'419800212018006',ci:'16341593',nombre:'RIVERO CHUMACERO KEILA ALEXIA',gender:'F',fecha:'21 de oct. de 2013',grade:1,parallel:'B'},
  {rude:'819100052016018',ci:'14256056',nombre:'ROCHA GUZMAN GERARDO JESE',gender:'M',fecha:'5 de jun. de 2012',grade:1,parallel:'B'},
  {rude:'419800312018066',ci:'13743655',nombre:'RODAS PEREZ ARELY',gender:'F',fecha:'3 de dic. de 2012',grade:1,parallel:'B'},
  {rude:'419800212018030',ci:'13458149',nombre:'SALAZAR PEÑA MILAN GABRIEL',gender:'M',fecha:'25 de jun. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018083',ci:'13743712',nombre:'SIBAUTTI HERRERA LUIS ALFREDO',gender:'M',fecha:'10 de jul. de 2013',grade:1,parallel:'B'},
  {rude:'419800212018026',ci:'14611744',nombre:'SILVESTRE MEJIA JHOSEANY',gender:'F',fecha:'10 de abr. de 2014',grade:1,parallel:'B'},
  {rude:'419800212019001',ci:'15594963',nombre:'SOLIS BARRIENTOS DYLAN SNAIDER',gender:'M',fecha:'3 de mar. de 2014',grade:1,parallel:'B'},
  {rude:'419800212018024',ci:'16796193',nombre:'ULLOA PADILLA KAIRY YALEN',gender:'F',fecha:'9 de ene. de 2014',grade:1,parallel:'B'},
  {rude:'519800022018088',ci:'16707858',nombre:'VEIZAGA SANTOS EMIL',gender:'M',fecha:'12 de abr. de 2013',grade:1,parallel:'B'},
  {rude:'419800212019009',ci:'16826925',nombre:'YUCA MAMANI MILAN SANTINO',gender:'M',fecha:'22 de abr. de 2014',grade:1,parallel:'B'},
  // ── GRADO 1 · PARALELO C ──────────────────────────────────────────────────
  {rude:'419800212018031',ci:'16783436',nombre:'ACHO RAMIREZ KAREN NATALIA',gender:'F',fecha:'2 de may. de 2014',grade:1,parallel:'C'},
  {rude:'419800942018001',ci:'17066498',nombre:'AGUILAR GARCIA GAEL',gender:'M',fecha:'1 de ago. de 2013',grade:1,parallel:'C'},
  {rude:'419800212019006',ci:'16582054',nombre:'ALCARAZ APAZA NADIA',gender:'F',fecha:'20 de dic. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018102',ci:'14734291',nombre:'ALVAREZ MARTINEZ NOEL ALEXANDER',gender:'M',fecha:'22 de dic. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018066',ci:'14274691',nombre:'ANTIVEROS QUISPE DAVID CARLOS',gender:'M',fecha:'9 de oct. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018065',ci:'15100294',nombre:'ARROYO CLAURE ASHLEY DAVINIA',gender:'F',fecha:'25 de ago. de 2013',grade:1,parallel:'C'},
  {rude:'419800262019058',ci:'14941205',nombre:'BARROSO ORIAS LUCAS FABRICIO',gender:'M',fecha:'28 de feb. de 2014',grade:1,parallel:'C'},
  {rude:'419800262019021',ci:'15588651',nombre:'CABELLO ORTIZ ALEJANDRA',gender:'F',fecha:'3 de ene. de 2014',grade:1,parallel:'C'},
  {rude:'419800212018088',ci:'14604029',nombre:'CABRERA CARRISALES YADIEL',gender:'M',fecha:'2 de abr. de 2014',grade:1,parallel:'C'},
  {rude:'419800212018076',ci:'15013280',nombre:'CARLOS ROMERO YERALDY XOMARA',gender:'F',fecha:'21 de feb. de 2014',grade:1,parallel:'C'},
  {rude:'419800212018074',ci:'16854022',nombre:'CARRIAZO ROCHA RIZVAN',gender:'M',fecha:'21 de ene. de 2014',grade:1,parallel:'C'},
  {rude:'419800212017010',ci:'16207826',nombre:'CHAVEZ MEJIA JOSUE',gender:'M',fecha:'13 de jun. de 2013',grade:1,parallel:'C'},
  {rude:'419800212017066',ci:'13691566',nombre:'COLQUE ACHO PAULA LORENA',gender:'F',fecha:'25 de dic. de 2012',grade:1,parallel:'C'},
  {rude:'419800722019001',ci:'15962008',nombre:'CUELLAR RIVERA DAIRA',gender:'F',fecha:'27 de jun. de 2014',grade:1,parallel:'C'},
  {rude:'419800942018026',ci:'14611750',nombre:'FERNANDEZ PEÑA MATIAS',gender:'M',fecha:'29 de oct. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018038',ci:'14603868',nombre:'GUTIERREZ DURAN MICHELLE ALONDRA',gender:'F',fecha:'25 de ago. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018023',ci:'15970720',nombre:'GUZMAN CHINO ANGELICA',gender:'F',fecha:'11 de jun. de 2014',grade:1,parallel:'C'},
  {rude:'419800212018070',ci:'16315971',nombre:'JALDIN QUINTANA ANALIA',gender:'F',fecha:'15 de set. de 2013',grade:1,parallel:'C'},
  {rude:'419800312017034',ci:'16947599',nombre:'LANZA ALVAREZ SAID',gender:'M',fecha:'7 de feb. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018032',ci:'15592051',nombre:'LARA ARIAS YAIMARA',gender:'F',fecha:'7 de dic. de 2013',grade:1,parallel:'C'},
  {rude:'4198006020189669',ci:'16210276',nombre:'MORUCHI FLORES ISABEL CRISTINA',gender:'F',fecha:'28 de set. de 2012',grade:1,parallel:'C'},
  {rude:'419800212019004',ci:'15702665',nombre:'PALZA ESCOBAR MIELLINE',gender:'F',fecha:'8 de may. de 2014',grade:1,parallel:'C'},
  {rude:'419800212018063',ci:'14610585',nombre:'PANTOJA VALLE ALEXANDER',gender:'M',fecha:'3 de jul. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018062',ci:'15191910',nombre:'PANTOJA VALLE ALEXIA',gender:'F',fecha:'3 de jul. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018064',ci:'14610584',nombre:'PANTOJA VALLE ALEXY',gender:'M',fecha:'3 de jul. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018056',ci:'16754537',nombre:'PRADO FIGUEROA CAROL IVANA',gender:'F',fecha:'5 de feb. de 2014',grade:1,parallel:'C'},
  {rude:'419800212018057',ci:'17337100',nombre:'PRADO FIGUEROA JOSUE ANDRES',gender:'M',fecha:'5 de feb. de 2014',grade:1,parallel:'C'},
  {rude:'419800262019073',ci:'17038527',nombre:'RODA BARROZO LUIS SANTIAGO',gender:'M',fecha:'11 de abr. de 2014',grade:1,parallel:'C'},
  {rude:'419800212018089',ci:'14434889',nombre:'ROSAS MEDINA ROSARIO',gender:'F',fecha:'1 de nov. de 2013',grade:1,parallel:'C'},
  {rude:'419800262019077',ci:'17019449',nombre:'SANCHEZ CUELLAR BRENDAN ESTEP',gender:'M',fecha:'7 de feb. de 2014',grade:1,parallel:'C'},
  {rude:'419800262018066',ci:'17008581',nombre:'TABORGA CHAVEZ YOIHSY GABRIELA',gender:'F',fecha:'30 de mar. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018100',ci:'13465484',nombre:'TOPOCO ROMERO LUIS JHONATAN',gender:'M',fecha:'5 de ago. de 2013',grade:1,parallel:'C'},
  {rude:'419800912018043',ci:'14171562',nombre:'TORDOYA BONILLA KESIA VALENTINA',gender:'F',fecha:'26 de ago. de 2013',grade:1,parallel:'C'},
  {rude:'419800652018007',ci:'13484361',nombre:'VALLEJOS FLORES KRISTIAN',gender:'M',fecha:'10 de oct. de 2013',grade:1,parallel:'C'},
  {rude:'419800212018081',ci:'15172078',nombre:'VILLCA ORIAS EMILY',gender:'F',fecha:'14 de ene. de 2014',grade:1,parallel:'C'},
  {rude:'419800712018035',ci:'15277517',nombre:'ZURITA VARGAS JOSE GABRIEL',gender:'M',fecha:'1 de jul. de 2013',grade:1,parallel:'C'},
  // ── GRADO 2 · PARALELO A ──────────────────────────────────────────────────
  {rude:'419800212017060',ci:'17077294',nombre:'ALVAREZ FLORES EDWAR NEYMAR',gender:'M',fecha:'23 de abr. de 2013',grade:2,parallel:'A'},
  {rude:'419800302017086',ci:'14099188',nombre:'BALDELOMAR BALDERRAMA HIAN YAIR',gender:'M',fecha:'14 de ene. de 2013',grade:2,parallel:'A'},
  {rude:'419800262018032',ci:'17020236',nombre:'BARRIENTOS CUBA ANYELINE YULIETH',gender:'F',fecha:'9 de ago. de 2012',grade:2,parallel:'A'},
  {rude:'419800262018011',ci:'14990722',nombre:'CABRERA CHAVEZ AILAM ANDRE',gender:'M',fecha:'12 de oct. de 2012',grade:2,parallel:'A'},
  {rude:'419800212017007',ci:'14171652',nombre:'CAMPO ARROYO VALERIA',gender:'F',fecha:'3 de set. de 2012',grade:2,parallel:'A'},
  {rude:'419800712017016',ci:'16195388',nombre:'CASTILLO USCAMAYTA BRIANA',gender:'F',fecha:'17 de oct. de 2012',grade:2,parallel:'A'},
  {rude:'419800582017007',ci:'16726894',nombre:'CHAVARRIA CHOQUE CLAUDIA',gender:'F',fecha:'5 de ago. de 2012',grade:2,parallel:'A'},
  {rude:'419800212017039',ci:'16309893',nombre:'CLAURE ESCOBAR BRIYID MICHELL',gender:'F',fecha:'13 de set. de 2012',grade:2,parallel:'A'},
  {rude:'419800212016036',ci:'14030120',nombre:'CORREA VARGAS CARLOS ALFREDO',gender:'M',fecha:'7 de abr. de 2012',grade:2,parallel:'A'},
  {rude:'419800942018010',ci:'14611751',nombre:'FERNANDEZ PEÑA EMANUEL',gender:'M',fecha:'10 de jul. de 2012',grade:2,parallel:'A'},
  {rude:'419800312017059',ci:'14521390',nombre:'FLORES MOJIANO YAIL',gender:'M',fecha:'28 de nov. de 2012',grade:2,parallel:'A'},
  {rude:'419800072017012',ci:'14780533',nombre:'FLORES DAZA JESUS MIJAEL',gender:'M',fecha:'7 de jun. de 2013',grade:2,parallel:'A'},
  {rude:'419800212017068',ci:'13742306',nombre:'FLORES PUMA DANIELA',gender:'F',fecha:'14 de abr. de 2013',grade:2,parallel:'A'},
  {rude:'419800212017047',ci:'14162474',nombre:'GARCIA GARCIA DHAYLA DENISS',gender:'F',fecha:'15 de abr. de 2013',grade:2,parallel:'A'},
  {rude:'419800302017092',ci:'14973385',nombre:'GONZALES CASTRO FABIANA',gender:'F',fecha:'14 de set. de 2012',grade:2,parallel:'A'},
  {rude:'817100102017022',ci:'12786441',nombre:'GUADUAY PUMACAYO SHEILA NAOMI',gender:'F',fecha:'28 de mar. de 2013',grade:2,parallel:'A'},
  {rude:'419800212017073',ci:'17364942',nombre:'LEON ULLOA CRISTHIAN',gender:'M',fecha:'18 de ene. de 2013',grade:2,parallel:'A'},
  {rude:'4198002320266011',ci:'18029911',nombre:'MEJIA AYHUASI EMERSON NOEL',gender:'M',fecha:'27 de oct. de 2012',grade:2,parallel:'A'},
  {rude:'419800212017077',ci:'15711882',nombre:'OCAÑA SANGREDE MATHIAS ALEJANDRO',gender:'M',fecha:'3 de jun. de 2013',grade:2,parallel:'A'},
  {rude:'419800212017054',ci:'14611093',nombre:'ORTIZ ORELLANA DYLAN MATIAS',gender:'M',fecha:'25 de ene. de 2013',grade:2,parallel:'A'},
  {rude:'419800322017020',ci:'14031437',nombre:'PINTO FERNANDEZ JULIO LEANDRO',gender:'M',fecha:'2 de ene. de 2013',grade:2,parallel:'A'},
  {rude:'419800212017025',ci:'14277364',nombre:'PRADO MORALES ZAMARICH',gender:'F',fecha:'29 de ago. de 2012',grade:2,parallel:'A'},
  {rude:'419800212016054',ci:'16754552',nombre:'PRADO FIGUEROA ESTHER NAZARET',gender:'F',fecha:'1 de set. de 2011',grade:2,parallel:'A'},
  {rude:'419800262017077',ci:'17014099',nombre:'RIOS AGUILAR MATIAS',gender:'M',fecha:'18 de feb. de 2012',grade:2,parallel:'A'},
  {rude:'419800262018075',ci:'17038492',nombre:'RODA BARROZO DARIANA',gender:'F',fecha:'9 de jul. de 2012',grade:2,parallel:'A'},
  {rude:'419800322017022',ci:'14942026',nombre:'ROJAS SERRUDO KENIA',gender:'F',fecha:'15 de ago. de 2012',grade:2,parallel:'A'},
  {rude:'519800642017021',ci:'15285964',nombre:'SEGARRA PEREYRA YHEZEBEL NICED',gender:'F',fecha:'14 de oct. de 2012',grade:2,parallel:'A'},
  {rude:'419800312018067',ci:'15206411',nombre:'VALVERDE GUERRERO BRISA JHARIT',gender:'F',fecha:'24 de nov. de 2012',grade:2,parallel:'A'},
  {rude:'419800212017059',ci:'14876247',nombre:'VEDIA VILLARES THIAGO',gender:'M',fecha:'24 de jun. de 2013',grade:2,parallel:'A'},
  {rude:'419800212017030',ci:'14990721',nombre:'VELASCO FLORES YULITZE',gender:'F',fecha:'14 de dic. de 2012',grade:2,parallel:'A'},
  {rude:'419800212017029',ci:'14990720',nombre:'VELASCO FLORES YELITZE',gender:'F',fecha:'14 de dic. de 2012',grade:2,parallel:'A'},
  {rude:'419800302017385A',ci:'16549873',nombre:'ZENTENO FIGUEROA RASHELL CAMILA',gender:'F',fecha:'12 de jun. de 2013',grade:2,parallel:'A'},
  {rude:'419800212017090',ci:'15030999',nombre:'ZENZANO TORREZ BENJAMIN',gender:'M',fecha:'15 de jun. de 2013',grade:2,parallel:'A'},
  // ── GRADO 2 · PARALELO B ──────────────────────────────────────────────────
  {rude:'419800212018003',ci:'14767325',nombre:'ACUÑA AIZA ALDAIL ALEXIS',gender:'M',fecha:'19 de mar. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017001',ci:'15520556',nombre:'ADAN RIVERO ANA SIBONEY',gender:'F',fecha:'30 de jul. de 2012',grade:2,parallel:'B'},
  {rude:'419800272018031',ci:'15514595',nombre:'AGUAYO PEÑARRIETA ARACELY',gender:'F',fecha:'14 de feb. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017002',ci:'14048007',nombre:'AGUILAR CARTAGENA BRAYAN',gender:'M',fecha:'17 de may. de 2013',grade:2,parallel:'B'},
  {rude:'419800262018030',ci:'17066268',nombre:'BARRIENTOS MARTINEZ CAMILA',gender:'F',fecha:'13 de dic. de 2012',grade:2,parallel:'B'},
  {rude:'419800212017033',ci:'14781366',nombre:'BARRIOS MAMANI LUCIANNE ALEXIA',gender:'F',fecha:'19 de feb. de 2013',grade:2,parallel:'B'},
  {rude:'419800312017038',ci:'14277699',nombre:'BASUALDO ROSADO YULIET KAREN AYELEN',gender:'F',fecha:'18 de mar. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017035',ci:'15260894',nombre:'BENITEZ MURILLO KIM SARAY',gender:'F',fecha:'22 de ene. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017063',ci:'17009787',nombre:'BURGOS PACO KETERIN MAITHE',gender:'F',fecha:'27 de set. de 2012',grade:2,parallel:'B'},
  {rude:'419800322017015',ci:'15986105',nombre:'CABRERA ALCOBA MARISABEL',gender:'F',fecha:'11 de mar. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017064',ci:'16315699',nombre:'CARBAJAL MAMANI ZAHELY',gender:'F',fecha:'3 de ene. de 2013',grade:2,parallel:'B'},
  {rude:'419800312017042',ci:'15776738',nombre:'CARRISALES LOPEZ MILAN HANDEL',gender:'M',fecha:'6 de jun. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017037',ci:'15965704',nombre:'CESPEDES DIAZ YANDI',gender:'F',fecha:'15 de jul. de 2012',grade:2,parallel:'B'},
  {rude:'419800212017065',ci:'14781161',nombre:'CLAROS ZAPATA RODRIGO',gender:'M',fecha:'27 de ene. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017042',ci:'14277465',nombre:'CORONADO VARGAS SANTIAGO HERNAN',gender:'M',fecha:'7 de set. de 2012',grade:2,parallel:'B'},
  {rude:'519800072018017',ci:'12789435',nombre:'CUELLAR RIVERA BRIANNA',gender:'F',fecha:'31 de jul. de 2012',grade:2,parallel:'B'},
  {rude:'419800212017012',ci:'14247507',nombre:'CUELLAR SANTOS BRIANA',gender:'F',fecha:'26 de jun. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017046',ci:'14780319',nombre:'ESTRADA MARTINEZ KIARA MELANIE',gender:'F',fecha:'29 de ago. de 2012',grade:2,parallel:'B'},
  {rude:'419800312018029',ci:'13335538',nombre:'FRANCO RODRIGUEZ DENER',gender:'M',fecha:'4 de oct. de 2012',grade:2,parallel:'B'},
  {rude:'419800072018017',ci:'17017314',nombre:'GONZALES QUEMAYA EYSA NICOL',gender:'F',fecha:'8 de may. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017018',ci:'14412253',nombre:'HEREDIA FERNANDEZ ASHLEY NICKOLE',gender:'F',fecha:'24 de nov. de 2012',grade:2,parallel:'B'},
  {rude:'419800212017020',ci:'15081432',nombre:'JIMENEZ FLORES DULCE ROMINA',gender:'F',fecha:'10 de may. de 2013',grade:2,parallel:'B'},
  {rude:'819812172018068',ci:'14277788',nombre:'LEAÑOS PRADO YORDY CRISTOBAL',gender:'M',fecha:'12 de ago. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017051',ci:'16350476',nombre:'LEYTON CRUZ DAVID',gender:'M',fecha:'28 de feb. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017052',ci:'14610996',nombre:'MALDONADO SILES RADAMEL',gender:'M',fecha:'25 de ene. de 2013',grade:2,parallel:'B'},
  {rude:'419800712017027',ci:'17168975',nombre:'MATURANO URQUIZU NAYELY',gender:'F',fecha:'2 de jul. de 2012',grade:2,parallel:'B'},
  {rude:'419800162018001',ci:'14610653',nombre:'MEDINA MARTINEZ YINMY',gender:'M',fecha:'12 de feb. de 2013',grade:2,parallel:'B'},
  {rude:'419800212017053',ci:'15587837',nombre:'NUÑEZ MURILLO URIEL DANIEL',gender:'M',fecha:'17 de jun. de 2013',grade:2,parallel:'B'},
  {rude:'419800912017009',ci:'17345012',nombre:'RIBERA TERRAZAS DAYRA JASLIN',gender:'F',fecha:'17 de may. de 2013',grade:2,parallel:'B'},
  {rude:'419800302017076',ci:'14409965',nombre:'RODRIGUEZ CLAROS LIZ LEIDY',gender:'F',fecha:'13 de dic. de 2012',grade:2,parallel:'B'},
  {rude:'419800212017058',ci:'14161669',nombre:'SANCHEZ RODRIGUEZ ALFREDO',gender:'M',fecha:'16 de abr. de 2013',grade:2,parallel:'B'},
  {rude:'819800832017030',ci:'16834465',nombre:'VIZA APAZA LIBNY LUANI',gender:'F',fecha:'26 de ene. de 2012',grade:2,parallel:'B'},
  // ── GRADO 2 · PARALELO C ──────────────────────────────────────────────────
  {rude:'419800212017003',ci:'14281881',nombre:'AREVALO ZEGARRA JOSUE MATHIAS',gender:'M',fecha:'14 de oct. de 2012',grade:2,parallel:'C'},
  {rude:'819814312017098',ci:'13742320',nombre:'CEREZO RIOS MERI YENS',gender:'F',fecha:'21 de may. de 2012',grade:2,parallel:'C'},
  {rude:'419800212017009',ci:'15728508',nombre:'CESPEDES VEDIA DARIL MARIEL',gender:'F',fecha:'11 de feb. de 2013',grade:2,parallel:'C'},
  {rude:'419800212017014',ci:'16583566',nombre:'ENRRIQUEZ MAMANI ARID FERNANDA',gender:'F',fecha:'13 de may. de 2013',grade:2,parallel:'C'},
  {rude:'419800212017045',ci:'17000529',nombre:'ESCALERA LINO KAREN MAITHE',gender:'F',fecha:'12 de abr. de 2013',grade:2,parallel:'C'},
  {rude:'419800652018048',ci:'16372292',nombre:'ESTRADA VIRUEZ FRANCISCO ELIAS',gender:'M',fecha:'26 de ene. de 2013',grade:2,parallel:'C'},
  {rude:'419800212017067',ci:'15282055',nombre:'FLORES BARRERA AMELIA CAROLINA',gender:'F',fecha:'24 de ene. de 2013',grade:2,parallel:'C'},
  {rude:'419800212017015',ci:'14781498',nombre:'GALARZA CONDORI NEIVILE',gender:'F',fecha:'25 de mar. de 2013',grade:2,parallel:'C'},
  {rude:'419800942017014',ci:'15731314',nombre:'GALLO ESTRADA AYLIN LUCERO',gender:'F',fecha:'25 de oct. de 2012',grade:2,parallel:'C'},
  {rude:'419800312017044',ci:'15601794',nombre:'GAMBOA HUAILLA YARITZA',gender:'F',fecha:'14 de ago. de 2012',grade:2,parallel:'C'},
  {rude:'519800072017045',ci:'15596394',nombre:'JALDIN LLENES GLENDA',gender:'F',fecha:'21 de oct. de 2012',grade:2,parallel:'C'},
  {rude:'419800212017072',ci:'13742362',nombre:'LEON PADILLA LUIS ANGEL',gender:'M',fecha:'11 de ene. de 2013',grade:2,parallel:'C'},
  {rude:'419800912017011',ci:'14277356',nombre:'LIMA CUESTAS MAYERLIN',gender:'F',fecha:'6 de jul. de 2012',grade:2,parallel:'C'},
  {rude:'419800212017076',ci:'16668747',nombre:'MEDINA ARIMOZA MIA SIMONE',gender:'F',fecha:'20 de abr. de 2013',grade:2,parallel:'C'},
  {rude:'419800262018020',ci:'14100346',nombre:'ORELLANA CRUZ YAMILETH',gender:'F',fecha:'25 de may. de 2013',grade:2,parallel:'C'},
  {rude:'419800212016105',ci:'13490739',nombre:'OROPEZA VEDIA JOEL NEIMAR',gender:'M',fecha:'9 de mar. de 2012',grade:2,parallel:'C'},
  {rude:'419800262017046',ci:'12858143',nombre:'OROPEZA OLLISCO FAVIO ANDRES',gender:'M',fecha:'12 de ago. de 2011',grade:2,parallel:'C'},
  {rude:'419800272018022',ci:'13742751',nombre:'PAREDES YAÑEZ YEALDS ANGELY',gender:'F',fecha:'22 de ene. de 2013',grade:2,parallel:'C'},
  {rude:'419800212017081',ci:'14610652',nombre:'QUENTA ALBORNOS HECTOR',gender:'M',fecha:'8 de jun. de 2013',grade:2,parallel:'C'},
  {rude:'419800282018002',ci:'16558583',nombre:'RAMIREZ PACO CAMILA',gender:'F',fecha:'16 de mar. de 2013',grade:2,parallel:'C'},
  {rude:'419800212017056',ci:'14780795',nombre:'ROCHA TITO ALEXIA FELICIA',gender:'F',fecha:'8 de oct. de 2012',grade:2,parallel:'C'},
  {rude:'419800212017057',ci:'14780794',nombre:'ROCHA TITO ALEXIS JENRY',gender:'M',fecha:'8 de oct. de 2012',grade:2,parallel:'C'},
  {rude:'419800572017006',ci:'14825307',nombre:'ROJAS LLANOS MILEISSA BRICELY',gender:'F',fecha:'18 de mar. de 2013',grade:2,parallel:'C'},
  {rude:'419800212017083',ci:'16132783',nombre:'SAUZA ARIAS ALIZON',gender:'F',fecha:'10 de jul. de 2012',grade:2,parallel:'C'},
  {rude:'419800212018001',ci:'15496326',nombre:'SEAS LEON WENDY',gender:'F',fecha:'11 de jun. de 2013',grade:2,parallel:'C'},
  {rude:'809700722019003',ci:'13426131',nombre:'SILVA CLAROS KEVIN',gender:'M',fecha:'29 de abr. de 2013',grade:2,parallel:'C'},
  {rude:'419800272017022',ci:'14362061',nombre:'TORRICO CASTRO MARIBEL',gender:'F',fecha:'9 de jul. de 2011',grade:2,parallel:'C'},
  {rude:'419800212017086',ci:'14049823',nombre:'VARGAS CONDORI SAMIR SAID',gender:'M',fecha:'31 de dic. de 2012',grade:2,parallel:'C'},
  {rude:'419800212017028',ci:'15648143',nombre:'VARGAS ORELLANA JHANDI MELANY',gender:'F',fecha:'6 de nov. de 2012',grade:2,parallel:'C'},
  {rude:'4198007120178276',ci:'13976324',nombre:'VARGAS GUTIERREZ THIAGO DOMINIC',gender:'M',fecha:'12 de jun. de 2013',grade:2,parallel:'C'},
  {rude:'419800722017008',ci:'14942372',nombre:'VELASQUEZ QUENTA ANCEL GABRIEL',gender:'M',fecha:'17 de set. de 2012',grade:2,parallel:'C'},
  {rude:'419800212018004',ci:'12981901',nombre:'VIDAL LIJERON NICOL',gender:'F',fecha:'16 de feb. de 2013',grade:2,parallel:'C'},
  {rude:'419800272018027',ci:'15768742',nombre:'YELMA HUAYHUA JHULIANA NICOL',gender:'F',fecha:'11 de ago. de 2012',grade:2,parallel:'C'},
  // ── GRADO 3 · PARALELO A ──────────────────────────────────────────────────
  {rude:'419800212016031',ci:'16070166',nombre:'ABUJDER VELASCO DARIAN',gender:'M',fecha:'13 de ene. de 2012',grade:3,parallel:'A'},
  {rude:'419800212016029',ci:'15707906',nombre:'ALVARES ROJAS MEELL YERALDINE',gender:'F',fecha:'2 de jun. de 2012',grade:3,parallel:'A'},
  {rude:'419800262017061',ci:'14434020',nombre:'BARRIGA AVALOS MARCELO',gender:'M',fecha:'23 de jul. de 2011',grade:3,parallel:'A'},
  {rude:'419800212016075',ci:'15597114',nombre:'CAIRO BEJARANO ARIANE',gender:'F',fecha:'3 de set. de 2011',grade:3,parallel:'A'},
  {rude:'419800212016055',ci:'15258543',nombre:'CASTRO SALVATIERRA XIMENA MERLIN',gender:'F',fecha:'30 de mar. de 2012',grade:3,parallel:'A'},
  {rude:'41980021201617004',ci:'14283294',nombre:'CRUZ FLORES DAYANA VICTORIA',gender:'F',fecha:'21 de set. de 2011',grade:3,parallel:'A'},
  {rude:'419800262017017',ci:'17211475',nombre:'GOMEZ TAPIA DAIMI',gender:'F',fecha:'19 de jun. de 2012',grade:3,parallel:'A'},
  {rude:'419800302017016',ci:'16070500',nombre:'GONZALES ARICOMA TANIA',gender:'F',fecha:'3 de may. de 2012',grade:3,parallel:'A'},
  {rude:'419800212016098',ci:'15776815',nombre:'HIPAMO MAMANI ALEXIA SAYURY',gender:'F',fecha:'12 de abr. de 2012',grade:3,parallel:'A'},
  {rude:'419800212016099',ci:'16178791',nombre:'LINO GUTIERREZ MIA LIZZIE',gender:'F',fecha:'9 de set. de 2011',grade:3,parallel:'A'},
  {rude:'419800212016086',ci:'14277637',nombre:'LOPEZ MAMANI YENNIFER YANDIRA',gender:'F',fecha:'14 de nov. de 2011',grade:3,parallel:'A'},
  {rude:'419800212016077',ci:'16771953',nombre:'LOPEZ FLORES ORIANA',gender:'F',fecha:'20 de feb. de 2012',grade:3,parallel:'A'},
  {rude:'419800212016046',ci:'15965510',nombre:'MALVERDE CARABALLO JAIRO JESUS',gender:'M',fecha:'26 de dic. de 2011',grade:3,parallel:'A'},
  {rude:'61890036201675611',ci:'16198199',nombre:'MAMANI GARRET YESSICA CELESTINA',gender:'F',fecha:'2 de jun. de 2011',grade:3,parallel:'A'},
  {rude:'419800212017091',ci:'15779953',nombre:'MAMANI GALARZA KEYLER GERSON',gender:'M',fecha:'10 de may. de 2012',grade:3,parallel:'A'},
  {rude:'419800212016035',ci:'14826081',nombre:'MAMANI FIGUEROA ADRIEL YUFEN',gender:'M',fecha:'18 de abr. de 2012',grade:3,parallel:'A'},
  {rude:'419800212016073',ci:'16332967',nombre:'MARISCAL FLORES ABEL',gender:'M',fecha:'7 de feb. de 2012',grade:3,parallel:'A'},
  {rude:'619000142015123',ci:'14570716',nombre:'MONTAÑO VIZA JOSE MIGUEL',gender:'M',fecha:'13 de ago. de 2010',grade:3,parallel:'A'},
  {rude:'419800212016024',ci:'14825601',nombre:'MURILLO VARON LEIDY ANDREA',gender:'F',fecha:'15 de dic. de 2011',grade:3,parallel:'A'},
  {rude:'419800212016102',ci:'13491378',nombre:'NAVARRO RAMOS MAX FARID',gender:'M',fecha:'29 de nov. de 2011',grade:3,parallel:'A'},
  {rude:'519800082014343',ci:'11303140',nombre:'OCHOA GARNICA CARLOS BRAYAN',gender:'M',fecha:'10 de mar. de 2010',grade:3,parallel:'A'},
  {rude:'419800212016071',ci:'14277351',nombre:'PADILLA ANTIVEROS KEVIN',gender:'M',fecha:'25 de abr. de 2012',grade:3,parallel:'A'},
  {rude:'419800312016058',ci:'13485126',nombre:'PADILLA ROMERO NICOLAS',gender:'M',fecha:'21 de ene. de 2012',grade:3,parallel:'A'},
  {rude:'419800162017003',ci:'14941087',nombre:'PADILLA PADILLA JOSE MIGUEL',gender:'M',fecha:'6 de set. de 2011',grade:3,parallel:'A'},
  {rude:'419800212016060',ci:'14611357',nombre:'PERALTA CORCHADO DAYMI',gender:'F',fecha:'12 de jul. de 2011',grade:3,parallel:'A'},
  {rude:'419800212016027',ci:'14611132',nombre:'PORCO MAMANI LIBNI BELEN',gender:'F',fecha:'12 de dic. de 2011',grade:3,parallel:'A'},
  {rude:'4198002120153453',ci:'15730176',nombre:'RAMOS ROQUE JOAB',gender:'M',fecha:'13 de mar. de 2011',grade:3,parallel:'A'},
  {rude:'41980021201686998',ci:'14971377',nombre:'REYNOSO GARCIA ROMINA',gender:'F',fecha:'18 de jun. de 2012',grade:3,parallel:'A'},
  {rude:'419800262017053',ci:'16548017',nombre:'RODRIGUEZ MONTAÑO JHEIMY BRITTANY',gender:'F',fecha:'28 de abr. de 2012',grade:3,parallel:'A'},
  {rude:'419800272017001',ci:'14277782',nombre:'ROSAS ACARAPI JOSUE',gender:'M',fecha:'30 de jun. de 2012',grade:3,parallel:'A'},
  {rude:'419800212016028',ci:'15371722',nombre:'SALAZAR MOSCOSO DANA PAOLA',gender:'F',fecha:'17 de dic. de 2011',grade:3,parallel:'A'},
  {rude:'809700722019365',ci:'12939457',nombre:'SENZANO CLAROS CRISTIAN',gender:'M',fecha:'6 de jun. de 2012',grade:3,parallel:'A'},
  {rude:'419800262017082',ci:'13902619',nombre:'SERRUDO BARJA SHARIT',gender:'F',fecha:'20 de jul. de 2011',grade:3,parallel:'A'},
  {rude:'419800212016103',ci:'15092201',nombre:'SEVERICHE BALDELOMAR YEIKOL',gender:'M',fecha:'16 de dic. de 2011',grade:3,parallel:'A'},
  {rude:'419800212016067',ci:'15215722',nombre:'VARON ROCHA RODRIGO',gender:'M',fecha:'19 de jul. de 2011',grade:3,parallel:'A'},
  {rude:'819815452016035',ci:'12825349',nombre:'VILLARROEL RIBERA CARMEN AMABELIT',gender:'F',fecha:'15 de jul. de 2011',grade:3,parallel:'A'},
  {rude:'419800212017093',ci:'15728583',nombre:'ZURITA HERRERA LUCAS YUCEF',gender:'M',fecha:'30 de dic. de 2011',grade:3,parallel:'A'},
  // ── GRADO 3 · PARALELO B ──────────────────────────────────────────────────
  {rude:'419800212016044',ci:'15790506',nombre:'APAZA RIVADENEIRA LUZ BELINDA',gender:'F',fecha:'6 de jul. de 2011',grade:3,parallel:'B'},
  {rude:'419800212016093',ci:'13211314',nombre:'AVILES RAMIREZ DAVINIA',gender:'F',fecha:'20 de ago. de 2011',grade:3,parallel:'B'},
  {rude:'419800212016074',ci:'15735109',nombre:'BEJARANO CUEBAS SHARITH YERALDINE',gender:'F',fecha:'5 de jun. de 2012',grade:3,parallel:'B'},
  {rude:'419800712016004',ci:'16195433',nombre:'CASTILLO USCAMAYTA ABDIEL MATEO',gender:'M',fecha:'23 de jul. de 2011',grade:3,parallel:'B'},
  {rude:'419800212016047',ci:'14396103',nombre:'CONTRERAS ROMERO MARICELA',gender:'F',fecha:'30 de may. de 2012',grade:3,parallel:'B'},
  {rude:'618801742016033',ci:'13364532',nombre:'CUELLAR BALDERAS GRISDEL',gender:'F',fecha:'14 de dic. de 2011',grade:3,parallel:'B'},
  {rude:'419800262017064',ci:'14825746',nombre:'GARCIA MATURANO YARITZA BELEN',gender:'F',fecha:'15 de oct. de 2011',grade:3,parallel:'B'},
  {rude:'419800212016062',ci:'14395492',nombre:'GARNICA MENECES CAMILA CARELY',gender:'F',fecha:'11 de jul. de 2011',grade:3,parallel:'B'},
  {rude:'419800622018003',ci:'16171040',nombre:'HURTADO HUAYHUA TANIA ARACELY',gender:'F',fecha:'25 de jul. de 2012',grade:3,parallel:'B'},
  {rude:'419800212016087',ci:'14396071',nombre:'IPORRE PINO JHAELY BRIGITTE',gender:'F',fecha:'24 de dic. de 2011',grade:3,parallel:'B'},
  {rude:'4198002620189339',ci:'13142928',nombre:'LAQUE ZAMBRANA ANGEL',gender:'M',fecha:'13 de oct. de 2010',grade:3,parallel:'B'},
  {rude:'419800212016023',ci:'15659926',nombre:'LLANOS QUIROZ LUZ ANGELICA',gender:'F',fecha:'30 de jun. de 2012',grade:3,parallel:'B'},
  {rude:'419800712016047',ci:'12759392',nombre:'LOPEZ LOPEZ AYELEN ZARITH',gender:'F',fecha:'29 de may. de 2012',grade:3,parallel:'B'},
  {rude:'4198002120147739',ci:'11398287',nombre:'LOVERA BALLESTEROS YHOISSY JASMIN',gender:'F',fecha:'20 de may. de 2010',grade:3,parallel:'B'},
  {rude:'419800262017006',ci:'17049403',nombre:'MAMANI CUCHALLO GABRIEL',gender:'M',fecha:'11 de set. de 2010',grade:3,parallel:'B'},
  {rude:'419800212016022',ci:'13742303',nombre:'MARQUEZ JOSE YESIBEL',gender:'F',fecha:'27 de oct. de 2011',grade:3,parallel:'B'},
  {rude:'419800212016106',ci:'15781123',nombre:'OLMOS AGUADO NEYMAR',gender:'M',fecha:'30 de may. de 2012',grade:3,parallel:'B'},
  {rude:'419800312016056',ci:'12571136',nombre:'ORONOS CHIRINO ANA CELESTE',gender:'F',fecha:'14 de nov. de 2011',grade:3,parallel:'B'},
  {rude:'419800722016007',ci:'14048341',nombre:'PAREDES CUCHALLO DARLING',gender:'F',fecha:'24 de abr. de 2012',grade:3,parallel:'B'},
  {rude:'419800212017098',ci:'15967405',nombre:'PEÑA MIRANDA MAXIMILIANO',gender:'M',fecha:'23 de mar. de 2012',grade:3,parallel:'B'},
  {rude:'419800572017010',ci:'17223052',nombre:'PINTO MAMANI ADRIEL',gender:'M',fecha:'12 de ago. de 2011',grade:3,parallel:'B'},
  {rude:'819803212016017',ci:'12357593',nombre:'RAMOS ABALOS JOSE ARIEL',gender:'M',fecha:'16 de set. de 2010',grade:3,parallel:'B'},
  {rude:'419800212016085',ci:'15656279',nombre:'ROMAN FUENTES LUCIANA',gender:'F',fecha:'16 de oct. de 2011',grade:3,parallel:'B'},
  {rude:'419800212016001',ci:'13433661',nombre:'ROSAS MEDINA HILTON',gender:'M',fecha:'20 de mar. de 2012',grade:3,parallel:'B'},
  {rude:'419800212017094',ci:'15966522',nombre:'SANCHEZ DELGADILLO SHIRLEY MIKEILA',gender:'F',fecha:'9 de feb. de 2012',grade:3,parallel:'B'},
  {rude:'419800312016070',ci:'14428690',nombre:'SEGARRA ZAMBRANA JASMIN',gender:'F',fecha:'2 de mar. de 2012',grade:3,parallel:'B'},
  {rude:'419800212016070',ci:'15408370',nombre:'SEGARRA LIJERON ANMY LIZ',gender:'F',fecha:'5 de set. de 2011',grade:3,parallel:'B'},
  {rude:'419800072016014',ci:'16424968',nombre:'SEÑA DAZA DANNA EMILY',gender:'F',fecha:'2 de may. de 2012',grade:3,parallel:'B'},
  {rude:'419800212016058',ci:'15204572',nombre:'SOLIZ DURAN WILSON GUILLERMO',gender:'M',fecha:'26 de mar. de 2012',grade:3,parallel:'B'},
  {rude:'419800212016069',ci:'10987769',nombre:'UGARTE VARGAS SEBASTIAN',gender:'M',fecha:'28 de feb. de 2012',grade:3,parallel:'B'},
  {rude:'41980021201628517',ci:'13428377',nombre:'VALLEJOS FLORES FERNANDA LUCIA',gender:'F',fecha:'17 de dic. de 2011',grade:3,parallel:'B'},
  {rude:'419800642017053',ci:'13109966',nombre:'VALVERDE AMADOR JUAN GERARDO',gender:'M',fecha:'27 de set. de 2011',grade:3,parallel:'B'},
  {rude:'808900712017423',ci:'10991291',nombre:'VARGAS ARCE JOSE DAVID',gender:'M',fecha:'4 de abr. de 2012',grade:3,parallel:'B'},
  {rude:'419800212016025',ci:'15960443',nombre:'VASQUEZ MEJIA JHON ANTHONY',gender:'M',fecha:'16 de may. de 2012',grade:3,parallel:'B'},
  {rude:'419800212016066',ci:'14503180',nombre:'VILLARES MAMANI OLIVER',gender:'M',fecha:'20 de nov. de 2011',grade:3,parallel:'B'},
  {rude:'419800262016088',ci:'16826950',nombre:'YUCA MAMANI CELESTE AYLEN',gender:'F',fecha:'30 de abr. de 2011',grade:3,parallel:'B'},
  {rude:'419800712016040',ci:'15277485',nombre:'ZURITA VARGAS NICK EDISON',gender:'M',fecha:'17 de may. de 2012',grade:3,parallel:'B'},
  // ── GRADO 3 · PARALELO C ──────────────────────────────────────────────────
  {rude:'419800312016002',ci:'13602271',nombre:'AGREDA GUAYAO IRIS ABRIL',gender:'F',fecha:'25 de may. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016040',ci:'15958834',nombre:'AGUILAR MENDOZA KEVIN ANDRE',gender:'M',fecha:'28 de abr. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016092',ci:'13301707',nombre:'ARCIBIA ESPINOZA ANAHI',gender:'F',fecha:'8 de may. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016090',ci:'15781336',nombre:'ARROYO URQUIZO KENIA DARINKA',gender:'F',fecha:'1 de abr. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016053',ci:'13691574',nombre:'BARRIENTOS LLANOS YENERY',gender:'F',fecha:'29 de jul. de 2011',grade:3,parallel:'C'},
  {rude:'419800212016095',ci:'15409979',nombre:'CARHUAS CARRIAZO MARIANNA',gender:'F',fecha:'27 de ago. de 2011',grade:3,parallel:'C'},
  {rude:'419800622018001',ci:'16171421',nombre:'CASERES HUAYHUA LEIDY',gender:'F',fecha:'19 de feb. de 2012',grade:3,parallel:'C'},
  {rude:'819804722016021',ci:'14682795',nombre:'CHOQUERE BELTRAN YARITA',gender:'F',fecha:'2 de set. de 2011',grade:3,parallel:'C'},
  {rude:'419800712016042',ci:'15058578',nombre:'ESCOBAR FLORES SERGIO ANDRE',gender:'M',fecha:'25 de mar. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016088',ci:'13904430',nombre:'ESTRADA ZAPATA DAIRA CRISTEL',gender:'F',fecha:'6 de jun. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016089',ci:'15161332',nombre:'ESTRADA CRUZ JOEL DANNY',gender:'M',fecha:'1 de abr. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016037',ci:'14353930',nombre:'GARCIA OSINAGA GERALDINNE',gender:'F',fecha:'21 de ago. de 2011',grade:3,parallel:'C'},
  {rude:'419800212016041',ci:'15960013',nombre:'GARNICA SARDAN JIMENA',gender:'F',fecha:'2 de jun. de 2012',grade:3,parallel:'C'},
  {rude:'419800712016018',ci:'13490731',nombre:'GONZALES MOJICA LUIS GERARDO',gender:'M',fecha:'3 de ene. de 2012',grade:3,parallel:'C'},
  {rude:'41980032201691638',ci:'17404372',nombre:'GUTIERREZ TICLLA YARITZA',gender:'F',fecha:'28 de may. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016057',ci:'15361453',nombre:'GUZMAN CARABALLO ANNY MILEIDY',gender:'F',fecha:'19 de set. de 2011',grade:3,parallel:'C'},
  {rude:'419800212016100',ci:'15778410',nombre:'LLANOS TERAN ADRIANA',gender:'F',fecha:'5 de ene. de 2012',grade:3,parallel:'C'},
  {rude:'419800712016045',ci:'14435054',nombre:'LOPEZ ZAMBRANA CARLOS DENILSON',gender:'M',fecha:'29 de dic. de 2011',grade:3,parallel:'C'},
  {rude:'419800282016019',ci:'14100637',nombre:'MAMANI BURGOS ROSARIO MARELY',gender:'F',fecha:'7 de oct. de 2010',grade:3,parallel:'C'},
  {rude:'419800212016039',ci:'15480800',nombre:'MANSILLA AGUADO DUSAN JEREMY',gender:'M',fecha:'30 de set. de 2011',grade:3,parallel:'C'},
  {rude:'619000142016069',ci:'14570717',nombre:'MONTAÑO VIZA YENIFER',gender:'F',fecha:'11 de may. de 2012',grade:3,parallel:'C'},
  {rude:'419800162017009',ci:'17261257',nombre:'MORALES CEREZO ERNESTO',gender:'M',fecha:'16 de mar. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016101',ci:'13485193',nombre:'NEGRETE CHURATA LOU SEBASTIAN',gender:'M',fecha:'30 de nov. de 2011',grade:3,parallel:'C'},
  {rude:'419800212016026',ci:'15960246',nombre:'OCHOA SARDAN KEVIN DANIEL',gender:'M',fecha:'26 de ene. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016083',ci:'15752937',nombre:'PEÑA CLAURE MILEY ANYELY',gender:'F',fecha:'13 de nov. de 2011',grade:3,parallel:'C'},
  {rude:'419800212016080',ci:'15956317',nombre:'PEREIRA LUCANA YERAL ALEXANDER',gender:'M',fecha:'6 de mar. de 2012',grade:3,parallel:'C'},
  {rude:'419800312016068',ci:'13601707',nombre:'POIQUI FAREL ANGEL NEIMAR',gender:'M',fecha:'9 de feb. de 2012',grade:3,parallel:'C'},
  {rude:'419800322016065',ci:'15548708',nombre:'PRADO CUBA BRUNO',gender:'M',fecha:'9 de may. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016078',ci:'15463664',nombre:'RODAS VEQUI JOHAN DAVID',gender:'M',fecha:'7 de mar. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016113',ci:'14941146',nombre:'SANCHEZ GUZMAN JOSE ANGEL',gender:'M',fecha:'16 de ene. de 2012',grade:3,parallel:'C'},
  {rude:'419800652017076',ci:'16783422',nombre:'SILES FIGUEROA FLAVIA ANDREA',gender:'F',fecha:'13 de jul. de 2011',grade:3,parallel:'C'},
  {rude:'419800212016104',ci:'15456237',nombre:'SOLIZ MAMANI MELANI',gender:'F',fecha:'6 de feb. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016081',ci:'14030105',nombre:'VALLEJOS APAZA LUCIANA MACIEL',gender:'F',fecha:'21 de oct. de 2011',grade:3,parallel:'C'},
  {rude:'4198007120172618',ci:'13976323',nombre:'VARGAS GUTIERREZ MILA PARIS',gender:'F',fecha:'26 de feb. de 2012',grade:3,parallel:'C'},
  {rude:'419800212016032',ci:'15412891',nombre:'VARGAS MOJIANO YESSICA',gender:'F',fecha:'25 de nov. de 2011',grade:3,parallel:'C'},
  {rude:'419800142016002',ci:'13690997',nombre:'YAMPARA CONDORI ALEX',gender:'M',fecha:'18 de ago. de 2011',grade:3,parallel:'C'},
  // ── GRADO 4 · PARALELO A ──────────────────────────────────────────────────
  {rude:'419800212016005',ci:'14571167',nombre:'AGUADO FLORES LUCIANE MARIELA',gender:'F',fecha:'4 de feb. de 2011',grade:4,parallel:'A'},
  {rude:'4198002120158273',ci:'14611500',nombre:'AGUILAR LIMON ANGELY LIANET',gender:'F',fecha:'29 de jun. de 2011',grade:4,parallel:'A'},
  {rude:'4198002120131399',ci:'17056873',nombre:'ARAUZ CONDORI VICTOR HUGO',gender:'M',fecha:'21 de nov. de 2007',grade:4,parallel:'A'},
  {rude:'81981517201596',ci:'14353855',nombre:'ARREDONDO CUELLAR ISABELLA',gender:'F',fecha:'17 de jun. de 2011',grade:4,parallel:'A'},
  {rude:'4198002120158307',ci:'13205042',nombre:'BORDA ROMERO JAEL KEILA',gender:'F',fecha:'25 de mar. de 2011',grade:4,parallel:'A'},
  {rude:'4198002120158311',ci:'14502807',nombre:'BURGOA ROJAS CHRISTEL DAVINIA',gender:'F',fecha:'29 de mar. de 2011',grade:4,parallel:'A'},
  {rude:'4198002120158326',ci:'15155273',nombre:'CABALLERO FIGUEROA MARLIN',gender:'F',fecha:'11 de jun. de 2011',grade:4,parallel:'A'},
  {rude:'4198002120158345',ci:'12951447',nombre:'CALLEJAS MENACHO ISABELLA VICTORIA',gender:'F',fecha:'23 de dic. de 2010',grade:4,parallel:'A'},
  {rude:'419800212015353A',ci:'14396478',nombre:'CARLOS ROMERO AMBERLY ARLEN',gender:'F',fecha:'5 de jul. de 2010',grade:4,parallel:'A'},
  {rude:'4198002120158364',ci:'14611501',nombre:'CUCHALLO ROBLEDO ALISSON CLARITZA',gender:'F',fecha:'4 de ago. de 2010',grade:4,parallel:'A'},
  {rude:'41980042201575',ci:'13601843',nombre:'ESCALANTE GIRON MAICOL',gender:'M',fecha:'24 de jul. de 2010',grade:4,parallel:'A'},
  {rude:'4198002120158402',ci:'14610705',nombre:'ESCALANTE BAIGORRIA CESAR ALEJANDRO',gender:'M',fecha:'18 de ago. de 2010',grade:4,parallel:'A'},
  {rude:'4198002120158417',ci:'15465044',nombre:'GALVIZ MENDOZA MARCELL EVANS',gender:'M',fecha:'16 de dic. de 2010',grade:4,parallel:'A'},
  {rude:'4198002120153616',ci:'15741344',nombre:'GUTIERREZ ROMERO YADIRA YEILY',gender:'F',fecha:'10 de jun. de 2011',grade:4,parallel:'A'},
  {rude:'7189000820135660',ci:'13367901',nombre:'HURTADO AVARIPA BENJAMIN',gender:'M',fecha:'30 de abr. de 2008',grade:4,parallel:'A'},
  {rude:'419800722016001',ci:'14780930',nombre:'LEAÑOS MORON SHAID',gender:'M',fecha:'15 de jun. de 2011',grade:4,parallel:'A'},
  {rude:'4198007120155285',ci:'12759320',nombre:'LOPEZ LOPEZ YOSTIN ELIOBETH',gender:'M',fecha:'5 de nov. de 2010',grade:4,parallel:'A'},
  {rude:'419800262016073',ci:'16187188',nombre:'LOPEZ LARA SEBASTIAN',gender:'M',fecha:'19 de ago. de 2010',grade:4,parallel:'A'},
  {rude:'4198002120153400',ci:'13485395',nombre:'MEDINA ARIMOZA LEYTHO CAMILO',gender:'M',fecha:'13 de abr. de 2011',grade:4,parallel:'A'},
  {rude:'419800652015139',ci:'14610307',nombre:'MONTAÑO MORON ALISON MICHEL',gender:'F',fecha:'12 de ene. de 2011',grade:4,parallel:'A'},
  {rude:'4198002120158489',ci:'11344139',nombre:'PACO YPURANI SKARLEEN',gender:'F',fecha:'14 de set. de 2010',grade:4,parallel:'A'},
  {rude:'419800212016112',ci:'15205034',nombre:'PADILLA MOLLO FLAVIO CESAR',gender:'M',fecha:'16 de feb. de 2011',grade:4,parallel:'A'},
  {rude:'419800212016006',ci:'14099834',nombre:'PEÑA RODRIGUEZ YENIFER',gender:'F',fecha:'22 de ene. de 2011',grade:4,parallel:'A'},
  {rude:'4198002120153688',ci:'15481352',nombre:'QUISPE CHAUQUE EMANUEL',gender:'M',fecha:'28 de abr. de 2011',grade:4,parallel:'A'},
  {rude:'4198003820152057',ci:'11369288',nombre:'ROMAN PALENQUE EILEEN',gender:'F',fecha:'10 de nov. de 2010',grade:4,parallel:'A'},
  {rude:'419800262016041',ci:'14605592',nombre:'SAGREDO CHUMACERO FLOR MAITE',gender:'F',fecha:'28 de set. de 2010',grade:4,parallel:'A'},
  {rude:'4198002120153711',ci:'14604034',nombre:'SANCHEZ CARRISALES SHANNEY',gender:'M',fecha:'21 de feb. de 2011',grade:4,parallel:'A'},
  {rude:'419800212016007',ci:'14605591',nombre:'SILES CHUMACERO MAILYN DAYANA',gender:'F',fecha:'23 de may. de 2011',grade:4,parallel:'A'},
  {rude:'4198002120158565',ci:'16198024',nombre:'VARGAS ORELLANA LISSY NAOMY',gender:'F',fecha:'3 de feb. de 2011',grade:4,parallel:'A'},
  {rude:'4198002120153487',ci:'14733814',nombre:'YUCRA CARI CARI DIANA BELEN',gender:'F',fecha:'19 de ago. de 2010',grade:4,parallel:'A'},
  {rude:'8198129420151306',ci:'13668275',nombre:'ZAPATA CORTEZ RAUL',gender:'M',fecha:'22 de abr. de 2011',grade:4,parallel:'A'},
  // ── GRADO 4 · PARALELO B ──────────────────────────────────────────────────
  {rude:'419800262016003',ci:'17459494',nombre:'ARAMAYO VEIZAGA NEYDA',gender:'F',fecha:'20 de jul. de 2010',grade:4,parallel:'B'},
  {rude:'41980030201517',ci:'15052221',nombre:'ARAUZ BALDERRAMA DANNA ALEXIA',gender:'F',fecha:'8 de feb. de 2011',grade:4,parallel:'B'},
  {rude:'419800312016035',ci:'17058675',nombre:'BALLESTEROS RODRIGUEZ MARIANA',gender:'F',fecha:'17 de ene. de 2011',grade:4,parallel:'B'},
  {rude:'41980021201539',ci:'15062364',nombre:'BEJARANO CHOQUE DANITZA JULIET',gender:'F',fecha:'28 de may. de 2011',grade:4,parallel:'B'},
  {rude:'4198002820153329',ci:'15986064',nombre:'CABRERA ALCOBA JOSE MANUEL',gender:'M',fecha:'18 de mar. de 2011',grade:4,parallel:'B'},
  {rude:'819814432016070',ci:'16336903',nombre:'CARBALLO ORTIZ LEONIDES ALBERTO',gender:'M',fecha:'15 de abr. de 2011',grade:4,parallel:'B'},
  {rude:'4198002120158785',ci:'13691011',nombre:'CARRILLO LEIVA KEILY MICHELLY',gender:'F',fecha:'13 de ene. de 2011',grade:4,parallel:'B'},
  {rude:'419800212015379',ci:'12599790',nombre:'CESPEDES MORALES JAAZIEL',gender:'M',fecha:'11 de mar. de 2011',grade:4,parallel:'B'},
  {rude:'4198007120155270',ci:'13690165',nombre:'CHUMACERO OROSCO ANGELINA',gender:'F',fecha:'11 de feb. de 2011',grade:4,parallel:'B'},
  {rude:'4198009120152534',ci:'16173701',nombre:'CONDORI FERNANDEZ TATIANA',gender:'F',fecha:'8 de ago. de 2010',grade:4,parallel:'B'},
  {rude:'41980021201539A',ci:'12388779',nombre:'CRUZ MERCADO CARLOS LEONEL',gender:'M',fecha:'12 de feb. de 2011',grade:4,parallel:'B'},
  {rude:'419800722015761',ci:'12789049',nombre:'CUPARI SILVESTRE JORGE MANUEL',gender:'M',fecha:'22 de dic. de 2010',grade:4,parallel:'B'},
  {rude:'419800212015412',ci:'12951379',nombre:'ESCOBAR CUELLAR ABDIEL',gender:'M',fecha:'14 de feb. de 2011',grade:4,parallel:'B'},
  {rude:'4198002120153620',ci:'13743688',nombre:'GUZMAN MARCANI YERI EDUTH',gender:'M',fecha:'4 de jul. de 2010',grade:4,parallel:'B'},
  {rude:'4198002120158455',ci:'12948998',nombre:'MANGUTA MORALES JOADEL',gender:'M',fecha:'6 de set. de 2010',grade:4,parallel:'B'},
  {rude:'419800262016016',ci:'17052994',nombre:'MONTAÑO GARCIA ZULEIDY',gender:'F',fecha:'24 de feb. de 2011',grade:4,parallel:'B'},
  {rude:'8191000520151915',ci:'16205665',nombre:'ORTUÑO GARCIA MAURICIO',gender:'M',fecha:'8 de may. de 2011',grade:4,parallel:'B'},
  {rude:'4198002120158508',ci:'13742746',nombre:'POIQUI FLORES YNGRID MELANY',gender:'F',fecha:'28 de oct. de 2010',grade:4,parallel:'B'},
  {rude:'4198002120147504',ci:'12561456',nombre:'PUMACAYO CARVALHO JAZMIN ANTONETH',gender:'F',fecha:'14 de nov. de 2009',grade:4,parallel:'B'},
  {rude:'4198007220156929',ci:'14971378',nombre:'REYNOSO GARCIA CAMILA',gender:'F',fecha:'24 de set. de 2010',grade:4,parallel:'B'},
  {rude:'4198002120153745',ci:'14030256',nombre:'VARGAS ASILLO MAIQUELY CAMILA',gender:'F',fecha:'10 de mar. de 2011',grade:4,parallel:'B'},
  {rude:'419800212016004',ci:'14990719',nombre:'VELASCO FLORES DASTAN JADIEL',gender:'M',fecha:'24 de ago. de 2010',grade:4,parallel:'B'},
  {rude:'419800272013213',ci:'14274711',nombre:'YAÑES CEREZO JOSELITO',gender:'M',fecha:'6 de ene. de 2008',grade:4,parallel:'B'},
  {rude:'419800272016046',ci:'13902972',nombre:'ZAPATA RODRIGUEZ YERSON',gender:'M',fecha:'9 de oct. de 2010',grade:4,parallel:'B'},
  // ── GRADO 4 · PARALELO C ──────────────────────────────────────────────────
  {rude:'419800272016006',ci:'15514726',nombre:'AGUAYO PEÑARRIETA DANIEL',gender:'M',fecha:'20 de may. de 2011',grade:4,parallel:'C'},
  {rude:'419800212016010',ci:'14605207',nombre:'ARAUZ CHAMBI LUIS DAVID',gender:'M',fecha:'17 de mar. de 2011',grade:4,parallel:'C'},
  {rude:'419800722016005',ci:'14353991',nombre:'BALLESTEROS ROJAS CARLA',gender:'F',fecha:'21 de ago. de 2010',grade:4,parallel:'C'},
  {rude:'419800212015363',ci:'15741130',nombre:'CALLA MARQUEZ NICOL ESTEFANY',gender:'F',fecha:'9 de jul. de 2010',grade:4,parallel:'C'},
  {rude:'419800212016002',ci:'15425044',nombre:'CARRIAZO RUEDA NAOMY DAVINIA',gender:'F',fecha:'15 de jun. de 2011',grade:4,parallel:'C'},
  {rude:'419800212016009',ci:'14283267',nombre:'CARTAGENA VALVERDE KEYLER GESIEL',gender:'M',fecha:'26 de nov. de 2010',grade:4,parallel:'C'},
  {rude:'419800302016018',ci:'14611987',nombre:'CASTRO RAMIREZ ABEL',gender:'M',fecha:'10 de mar. de 2011',grade:4,parallel:'C'},
  {rude:'81980285201525A',ci:'13601806',nombre:'COCA PINTO AURO JUNIOR',gender:'M',fecha:'13 de mar. de 2011',grade:4,parallel:'C'},
  {rude:'4198002120158398',ci:'12564980',nombre:'DABO CHOQUE SAMIRA DAYMI',gender:'F',fecha:'11 de feb. de 2011',grade:4,parallel:'C'},
  {rude:'4198002120153582',ci:'10983452',nombre:'FLORES CABRERA MARIA ANGELES',gender:'F',fecha:'14 de feb. de 2011',grade:4,parallel:'C'},
  {rude:'419800072015234',ci:'14780291',nombre:'FLORES DAZA MELANY MISHEL',gender:'F',fecha:'7 de jul. de 2011',grade:4,parallel:'C'},
  {rude:'4198002620154978',ci:'14605610',nombre:'GUAYGUA ACUÑA ANALIA',gender:'F',fecha:'23 de ago. de 2009',grade:4,parallel:'C'},
  {rude:'6188009420144539',ci:'17404358',nombre:'GUTIERREZ TICLLA DAYANA EMILY',gender:'F',fecha:'12 de oct. de 2009',grade:4,parallel:'C'},
  {rude:'419800212016014',ci:'14593139',nombre:'HUAYTA SOLIZ YOMITH',gender:'F',fecha:'16 de feb. de 2011',grade:4,parallel:'C'},
  {rude:'4198002120158421',ci:'14428935',nombre:'JALDIN ANCASI ESTHER NAOMI',gender:'F',fecha:'26 de nov. de 2010',grade:4,parallel:'C'},
  {rude:'419800212016017',ci:'15418304',nombre:'LARA TECO ALINY',gender:'F',fecha:'6 de set. de 2010',grade:4,parallel:'C'},
  {rude:'419800212016012',ci:'15659973',nombre:'LLANOS QUIROZ DIANA ESTEFANI',gender:'F',fecha:'30 de jul. de 2010',grade:4,parallel:'C'},
  {rude:'4198002120146307',ci:'14693775',nombre:'LLANOS QUIROZ DARLING MALEN',gender:'F',fecha:'25 de abr. de 2009',grade:4,parallel:'C'},
  {rude:'4198002120158440',ci:'16783428',nombre:'LOVERA MAMANI NAHOMI BELEN',gender:'F',fecha:'15 de mar. de 2011',grade:4,parallel:'C'},
  {rude:'419800212015846A',ci:'12564824',nombre:'MEJIA MARTINEZ NYLS DEYNAR',gender:'M',fecha:'15 de mar. de 2011',grade:4,parallel:'C'},
  {rude:'4198002120158474',ci:'15786335',nombre:'MORON MAMANI ALBERT ERICK',gender:'M',fecha:'25 de jun. de 2011',grade:4,parallel:'C'},
  {rude:'4198002120153669',ci:'12387619',nombre:'NEGRETE CUETO TATIANA',gender:'F',fecha:'23 de jul. de 2010',grade:4,parallel:'C'},
  {rude:'4198002120158493',ci:'14435193',nombre:'PANTOJA ALVAREZ ALISSON',gender:'F',fecha:'26 de jul. de 2011',grade:4,parallel:'C'},
  {rude:'419800262016043',ci:'14497470',nombre:'POLANCO BARRIENTOS YENNIFER',gender:'F',fecha:'4 de dic. de 2010',grade:4,parallel:'C'},
  {rude:'4198002120153726',ci:'14353055',nombre:'SERRUDO PADILLA AYHALEN',gender:'F',fecha:'28 de feb. de 2011',grade:4,parallel:'C'},
  {rude:'41980096201519',ci:'15744136',nombre:'VASQUEZ LLANOS NATIVIDAD',gender:'F',fecha:'25 de dic. de 2010',grade:4,parallel:'C'},
  // ── GRADO 5 · PARALELO A ──────────────────────────────────────────────────
  {rude:'819808172016057',ci:'13463993',nombre:'ARANCIBIA GONZALES DANIEL',gender:'M',fecha:'23 de feb. de 2010',grade:5,parallel:'A'},
  {rude:'419800262015493A',ci:'17020272',nombre:'BARRIENTOS CUBA MARIOLI',gender:'F',fecha:'17 de ago. de 2009',grade:5,parallel:'A'},
  {rude:'419800312013324',ci:'15588602',nombre:'CABELLO ORTIZ FERNANDA',gender:'F',fecha:'20 de mar. de 2009',grade:5,parallel:'A'},
  {rude:'4198007120155156',ci:'11300557',nombre:'CAMPO ARROYO CAMILA',gender:'F',fecha:'15 de mar. de 2010',grade:5,parallel:'A'},
  {rude:'4198002120147356',ci:'14681915',nombre:'CASTRO SALVATIERRA MELISA',gender:'F',fecha:'9 de mar. de 2010',grade:5,parallel:'A'},
  {rude:'4198002120147102',ci:'12694517',nombre:'CHOQUE RAPU ARIANA LUCIANA',gender:'F',fecha:'16 de feb. de 2010',grade:5,parallel:'A'},
  {rude:'4198002120147394',ci:'14277833',nombre:'CRUZ FERNANDEZ LUZ MERY',gender:'F',fecha:'20 de nov. de 2009',grade:5,parallel:'A'},
  {rude:'4198002120154608',ci:'14611270',nombre:'FERNANDEZ MAMANI EUNICE VICTORIA',gender:'F',fecha:'4 de mar. de 2010',grade:5,parallel:'A'},
  {rude:'419800212014716A',ci:'13742724',nombre:'FLORES PUMA ESTEFANI',gender:'F',fecha:'17 de ene. de 2010',grade:5,parallel:'A'},
  {rude:'419800212013103',ci:'13601783',nombre:'GALARZA CONDORI ALBEIRO',gender:'M',fecha:'18 de jun. de 2009',grade:5,parallel:'A'},
  {rude:'4198002120147690',ci:'16141078',nombre:'JUSTINIANO MERCADO HENRY ABDIEL',gender:'M',fecha:'18 de ene. de 2010',grade:5,parallel:'A'},
  {rude:'419800212015434A',ci:'15779834',nombre:'MAMANI GALARZA YARITZA',gender:'F',fecha:'2 de abr. de 2010',grade:5,parallel:'A'},
  {rude:'4198002120147466',ci:'9851587',nombre:'MAMANI MONTAÑO DIEBERSSON',gender:'M',fecha:'4 de oct. de 2009',grade:5,parallel:'A'},
  {rude:'4198002120154335',ci:'15779839',nombre:'MAMANI GALARZA YACIRA',gender:'F',fecha:'2 de abr. de 2010',grade:5,parallel:'A'},
  {rude:'4198006620141A',ci:'17000503',nombre:'MENDEZ SANDOVAL LIZETH',gender:'F',fecha:'12 de oct. de 2009',grade:5,parallel:'A'},
  {rude:'519800112015210',ci:'14030358',nombre:'MONTAÑO RIBERA YARITZA',gender:'F',fecha:'3 de set. de 2009',grade:5,parallel:'A'},
  {rude:'4198002120146766',ci:'13017506',nombre:'OILO FLORES VANESSA',gender:'F',fecha:'24 de mar. de 2009',grade:5,parallel:'A'},
  {rude:'419800312014246',ci:'12725581',nombre:'PELAEZ ESPINOZA AYLIN',gender:'F',fecha:'16 de set. de 2009',grade:5,parallel:'A'},
  {rude:'4198002120147777',ci:'14681935',nombre:'PEREIRA LUCANA MAICOL',gender:'M',fecha:'21 de jul. de 2009',grade:5,parallel:'A'},
  {rude:'8198026120131416',ci:'13728504',nombre:'PEREIRA PEREZ ARIADNE DENISSE',gender:'F',fecha:'4 de abr. de 2009',grade:5,parallel:'A'},
  {rude:'51980054201517829',ci:'15752842',nombre:'RODA BARROZO MARIA FERNANDA',gender:'F',fecha:'20 de oct. de 2009',grade:5,parallel:'A'},
  {rude:'4198002120147246',ci:'13333059',nombre:'RODRIGUEZ MARTINEZ CRISTIAN JAIR',gender:'M',fecha:'5 de set. de 2009',grade:5,parallel:'A'},
  {rude:'4198007120145034',ci:'16292901',nombre:'SALGUERO SALAZAR ALDAIR',gender:'M',fecha:'10 de jul. de 2010',grade:5,parallel:'A'},
  {rude:'4198002120154100',ci:'14681013',nombre:'SERRANO RAMOS CARLA MARIZEL',gender:'F',fecha:'13 de feb. de 2010',grade:5,parallel:'A'},
  {rude:'4198002120154134',ci:'14503178',nombre:'VILLARES MAMANI FABRICIO',gender:'M',fecha:'23 de set. de 2009',grade:5,parallel:'A'},
  // ── GRADO 5 · PARALELO B ──────────────────────────────────────────────────
  {rude:'4198002120147284',ci:'15087689',nombre:'ABUJDER VELASCO ARIANNE',gender:'F',fecha:'11 de nov. de 2009',grade:5,parallel:'B'},
  {rude:'4198002120153802',ci:'14680873',nombre:'ACUÑA TORRICO MARIA PAULA',gender:'F',fecha:'18 de ene. de 2010',grade:5,parallel:'B'},
  {rude:'4198002120147318',ci:'14016277',nombre:'ASILLO CONDORI AMARILIZ',gender:'F',fecha:'18 de may. de 2010',grade:5,parallel:'B'},
  {rude:'4198002720151960',ci:'12598183',nombre:'BARRIGA QUISPE FABRIZIO',gender:'M',fecha:'30 de dic. de 2009',grade:5,parallel:'B'},
  {rude:'419800212014705A',ci:'14725975',nombre:'CALLEJAS MARTINEZ DAYRA LUCIANA',gender:'F',fecha:'29 de dic. de 2009',grade:5,parallel:'B'},
  {rude:'819808562016058',ci:'14780806',nombre:'CAMARA CEREZO MAYERLIN',gender:'F',fecha:'28 de jul. de 2009',grade:5,parallel:'B'},
  {rude:'419800212013348',ci:'14162333',nombre:'CAREAGA URIONA DAYMI DAVINIA',gender:'F',fecha:'17 de ago. de 2009',grade:5,parallel:'B'},
  {rude:'419800622016002',ci:'16171477',nombre:'CASERES HUAYHUA DIANA',gender:'F',fecha:'2 de feb. de 2010',grade:5,parallel:'B'},
  {rude:'419800642015235A',ci:'12660872',nombre:'CESPEDES LEAÑO ALEJANDRA',gender:'F',fecha:'16 de oct. de 2009',grade:5,parallel:'B'},
  {rude:'4198002120147098',ci:'16754354',nombre:'CESPEDES MOREIRA ISRAEL URIEL',gender:'M',fecha:'31 de oct. de 2009',grade:5,parallel:'B'},
  {rude:'4198002120147083',ci:'15965745',nombre:'CESPEDES DIAZ CRISTIAN RONALDO',gender:'M',fecha:'17 de set. de 2009',grade:5,parallel:'B'},
  {rude:'419800312014134',ci:'15246952',nombre:'COLQUE DORADO WENDY YHANINE',gender:'F',fecha:'6 de oct. de 2009',grade:5,parallel:'B'},
  {rude:'4198002120147121',ci:'13690992',nombre:'CRUZ COLQUE FRANS OLIVER',gender:'M',fecha:'17 de feb. de 2010',grade:5,parallel:'B'},
  {rude:'4198002120147174',ci:'13365275',nombre:'GARNICA AZURDUY DAMARIS',gender:'F',fecha:'10 de ene. de 2010',grade:5,parallel:'B'},
  {rude:'4198002120154684',ci:'14605813',nombre:'LAIME HERRERA VICTOR MANUEL',gender:'M',fecha:'4 de mar. de 2010',grade:5,parallel:'B'},
  {rude:'4198002120147189',ci:'13303733',nombre:'MEDINA ESPINOZA JOSUE ABEL',gender:'M',fecha:'24 de jun. de 2010',grade:5,parallel:'B'},
  {rude:'419800272015447',ci:'15141657',nombre:'MENACHO GARCIA EMILSEN',gender:'F',fecha:'18 de ene. de 2010',grade:5,parallel:'B'},
  {rude:'4198002120147758',ci:'12676469',nombre:'MONTERO CHAVARRIA JUAN MIGUEL',gender:'M',fecha:'8 de may. de 2010',grade:5,parallel:'B'},
  {rude:'818600042014420',ci:'14362083',nombre:'ORIAS RODRIGUEZ XAVI ALCIDES',gender:'M',fecha:'30 de may. de 2010',grade:5,parallel:'B'},
  {rude:'4198002120154388',ci:'15109678',nombre:'PACO YPURANI ALEXIS MIGUEL',gender:'M',fecha:'21 de jul. de 2009',grade:5,parallel:'B'},
  {rude:'419800392015676',ci:'15373629',nombre:'PEÑARANDA PACO DEYSI',gender:'F',fecha:'17 de feb. de 2010',grade:5,parallel:'B'},
  {rude:'4198002120154775',ci:'16102141',nombre:'PINTO ORELLANA DAMARIS YAHIBEL',gender:'F',fecha:'28 de may. de 2010',grade:5,parallel:'B'},
  {rude:'419800092014411',ci:'13332289',nombre:'PURAMA ESPINOZA MILTON',gender:'M',fecha:'27 de ago. de 2008',grade:5,parallel:'B'},
  {rude:'4198002120154077',ci:'17014106',nombre:'RIOS AGUILAR ABRIL',gender:'F',fecha:'7 de abr. de 2010',grade:5,parallel:'B'},
  {rude:'419800722014993',ci:'16571951',nombre:'ROCHA FERNANDEZ FABIANA',gender:'F',fecha:'2 de feb. de 2010',grade:5,parallel:'B'},
  {rude:'4198009420151336',ci:'14030103',nombre:'RODRIGUEZ POLANCO CRISTHIAN DANIEL',gender:'M',fecha:'2 de ago. de 2009',grade:5,parallel:'B'},
  // ── GRADO 5 · PARALELO C ──────────────────────────────────────────────────
  {rude:'4198002120153817',ci:'14593146',nombre:'AGUILAR ACHACOLLO NICOLE',gender:'F',fecha:'11 de feb. de 2010',grade:5,parallel:'C'},
  {rude:'4198002120154521',ci:'14605208',nombre:'ARAUZ CHAMBI ESTHER SARAY',gender:'F',fecha:'9 de feb. de 2010',grade:5,parallel:'C'},
  {rude:'419800722015714',ci:'14854311',nombre:'ARIAS RIVADINEIRA TATIANA',gender:'F',fecha:'8 de may. de 2010',grade:5,parallel:'C'},
  {rude:'4198002120147322',ci:'13211315',nombre:'AVILES RAMIREZ VALENTINA',gender:'F',fecha:'8 de dic. de 2009',grade:5,parallel:'C'},
  {rude:'4198002120147045',ci:'13690979',nombre:'CABRERA CRUZ WILSON',gender:'M',fecha:'1 de may. de 2010',grade:5,parallel:'C'},
  {rude:'419800312014615',ci:'14161042',nombre:'CADIMA TORREZ JUAN PABLO',gender:'M',fecha:'10 de abr. de 2009',grade:5,parallel:'C'},
  {rude:'4198002120147079',ci:'12445402',nombre:'CASTELLON AVILA MAIKOL IKER',gender:'M',fecha:'26 de mar. de 2010',grade:5,parallel:'C'},
  {rude:'419800212014738A',ci:'14396005',nombre:'CONTRERAS ROMERO SISSI',gender:'F',fecha:'5 de set. de 2009',grade:5,parallel:'C'},
  {rude:'4198002120147409',ci:'12596847',nombre:'ENRRIQUEZ ZARATE DIANA',gender:'F',fecha:'4 de mar. de 2010',grade:5,parallel:'C'},
  {rude:'4198002120147428',ci:'13742285',nombre:'FLORES AGUILAR XIMENA',gender:'F',fecha:'29 de mar. de 2010',grade:5,parallel:'C'},
  {rude:'4198002120153984',ci:'14605282',nombre:'FLORES VIDAL NATALIA NIKOL',gender:'F',fecha:'3 de set. de 2009',grade:5,parallel:'C'},
  {rude:'419800312014160',ci:'12951090',nombre:'FRANCO RODRIGUEZ MIGUEL ANGEL',gender:'M',fecha:'22 de mar. de 2010',grade:5,parallel:'C'},
  {rude:'4198002120154612',ci:'15208134',nombre:'GALARZA GALARZA HANS BERTH',gender:'M',fecha:'20 de feb. de 2010',grade:5,parallel:'C'},
  {rude:'819812532014135',ci:'16507639',nombre:'GONZALES ARICOMA ANDERSON',gender:'M',fecha:'7 de ene. de 2010',grade:5,parallel:'C'},
  {rude:'4198002120147667',ci:'13428012',nombre:'GUTIERREZ PIZARRO CRISTHIAN ANDRES',gender:'M',fecha:'25 de mar. de 2010',grade:5,parallel:'C'},
  {rude:'4198002120147652',ci:'13300345',nombre:'GUTIERREZ PIZARRO ANDRES JHOEL',gender:'M',fecha:'25 de mar. de 2010',grade:5,parallel:'C'},
  {rude:'419800302013328',ci:'13743659',nombre:'GUZMAN FIGUEROA MIREISA',gender:'F',fecha:'3 de ene. de 2009',grade:5,parallel:'C'},
  {rude:'4198002120147447',ci:'11306891',nombre:'JUAN DE DIOS SOLIS FERNANDA',gender:'F',fecha:'16 de mar. de 2010',grade:5,parallel:'C'},
  {rude:'4198002120154369',ci:'16332902',nombre:'MARISCAL FLORES MARIA BELEN',gender:'F',fecha:'10 de jun. de 2010',grade:5,parallel:'C'},
  {rude:'4198007120144846',ci:'14780174',nombre:'MARTINEZ FLORES MATIAS',gender:'M',fecha:'2 de mar. de 2010',grade:5,parallel:'C'},
  {rude:'4198002120147193',ci:'12949886',nombre:'MONTENEGRO RODRIGUEZ THIAGO',gender:'M',fecha:'26 de mar. de 2010',grade:5,parallel:'C'},
  {rude:'4198002120147212',ci:'13491006',nombre:'OROPEZA VEDIA LIZ DUBEYSA',gender:'F',fecha:'11 de nov. de 2009',grade:5,parallel:'C'},
  {rude:'4198002820153610',ci:'15851261',nombre:'OSINAGA OSINAGA ANYELINE',gender:'F',fecha:'18 de may. de 2010',grade:5,parallel:'C'},
  {rude:'419800212015445A',ci:'14281900',nombre:'RAMOS TORRICO JHULIANA',gender:'F',fecha:'13 de mar. de 2010',grade:5,parallel:'C'},
  {rude:'4198007220153786',ci:'16349931',nombre:'RIVADINEIRA CORREA MILENA',gender:'F',fecha:'3 de jun. de 2010',grade:5,parallel:'C'},
  {rude:'419800272015634',ci:'15177154',nombre:'SALGUERO MARTINEZ JUAN PABLO',gender:'M',fecha:'1 de feb. de 2010',grade:5,parallel:'C'},
  {rude:'419800322014200',ci:'17019892',nombre:'SANCHEZ CUELLAR EVERY BRIANA',gender:'F',fecha:'10 de set. de 2009',grade:5,parallel:'C'},
  // ── GRADO 6 · PARALELO A ──────────────────────────────────────────────────
  {rude:'4198002120146622',ci:'14435241',nombre:'AGUILAR MENDOZA GILIANY',gender:'F',fecha:'25 de mar. de 2009',grade:6,parallel:'A'},
  {rude:'4198002120146584',ci:'15763813',nombre:'BELTRAN SICPORO BETSABE',gender:'F',fecha:'12 de dic. de 2008',grade:6,parallel:'A'},
  {rude:'419800262014693',ci:'14605572',nombre:'CALDERON CHAVEZ MARIA ISABEL',gender:'F',fecha:'22 de mar. de 2009',grade:6,parallel:'A'},
  {rude:'41980021201340',ci:'13365837',nombre:'CARREÑO CARRILLO ANGEL DANIEL',gender:'M',fecha:'22 de jun. de 2009',grade:6,parallel:'A'},
  {rude:'4198002120146216',ci:'15758860',nombre:'CHAVEZ MEJIA FIORI',gender:'M',fecha:'6 de mar. de 2009',grade:6,parallel:'A'},
  {rude:'4198002120127749',ci:'13980628',nombre:'CHOQUE CONDORI JOSUE MOISES',gender:'M',fecha:'11 de may. de 2008',grade:6,parallel:'A'},
  {rude:'4198002120121152',ci:'15307526',nombre:'DURAN GARCIA RAMIRO',gender:'M',fecha:'11 de mar. de 2007',grade:6,parallel:'A'},
  {rude:'419800212013423',ci:'14016275',nombre:'FLORES HERRERA ALEXEI',gender:'M',fecha:'29 de abr. de 2009',grade:6,parallel:'A'},
  {rude:'419800212013444',ci:'14781113',nombre:'GARCIA BARRIGA PAOLA',gender:'F',fecha:'3 de may. de 2009',grade:6,parallel:'A'},
  {rude:'419800302013242',ci:'11302651',nombre:'GARCIA PRADO RICHARD EDUARDO',gender:'M',fecha:'10 de feb. de 2009',grade:6,parallel:'A'},
  {rude:'419800312013350',ci:'14099081',nombre:'GUZMAN BALDERRAMA LIZ MARICELY',gender:'F',fecha:'9 de set. de 2008',grade:6,parallel:'A'},
  {rude:'618400162014860',ci:'14504240',nombre:'HUAILLA PADILLA JHON KEVIN',gender:'M',fecha:'19 de mar. de 2009',grade:6,parallel:'A'},
  {rude:'419800212013470',ci:'13602016',nombre:'JAMIRA FERNANDEZ DANIEL',gender:'M',fecha:'5 de nov. de 2008',grade:6,parallel:'A'},
  {rude:'4198002120146694',ci:'16772892',nombre:'LOPEZ FLORES MAILY MARELY',gender:'F',fecha:'4 de feb. de 2009',grade:6,parallel:'A'},
  {rude:'419800722013121A',ci:'14100238',nombre:'MARISCAL AGUADO SALLY YERAMEL',gender:'F',fecha:'21 de feb. de 2009',grade:6,parallel:'A'},
  {rude:'4198002120146330',ci:'15315241',nombre:'MEJIA QUENTA LIS HILLARY',gender:'F',fecha:'3 de feb. de 2009',grade:6,parallel:'A'},
  {rude:'4198003120123114',ci:'14275676',nombre:'MENDEZ SANDOVAL YUREM',gender:'M',fecha:'21 de ene. de 2008',grade:6,parallel:'A'},
  {rude:'4198002120146364',ci:'15788035',nombre:'MOREIRA VARGAS ANNETH MELODI',gender:'F',fecha:'12 de ene. de 2009',grade:6,parallel:'A'},
  {rude:'41980031201319A',ci:'14990012',nombre:'MURILLO DORADO YULIANA',gender:'F',fecha:'12 de may. de 2009',grade:6,parallel:'A'},
  {rude:'4198007120132239',ci:'14603865',nombre:'PEÑA SERRANO LEYRE PATRICIA',gender:'F',fecha:'13 de ene. de 2009',grade:6,parallel:'A'},
  {rude:'419800262013243',ci:'11344557',nombre:'PEREIRA BONILLA JHON DEALER',gender:'M',fecha:'13 de oct. de 2008',grade:6,parallel:'A'},
  {rude:'4198002120146398',ci:'16750968',nombre:'RODRIGUEZ FIGUEROA JHARETH LIBIAN',gender:'F',fecha:'22 de jun. de 2009',grade:6,parallel:'A'},
  {rude:'8198083220148081',ci:'14435488',nombre:'SORIA LEAÑO ALEJANDRO',gender:'M',fecha:'23 de mar. de 2009',grade:6,parallel:'A'},
  {rude:'4198007120132391',ci:'13300620',nombre:'SOTO BANUS ARTURO',gender:'M',fecha:'12 de may. de 2009',grade:6,parallel:'A'},
  {rude:'819809652014393',ci:'13271415',nombre:'TERRAZAS RIVERA NAYOVY PADME',gender:'F',fecha:'2 de mar. de 2009',grade:6,parallel:'A'},
  {rude:'419800212013299',ci:'13017772',nombre:'VALLE TORREZ MILENA',gender:'F',fecha:'2 de ene. de 2009',grade:6,parallel:'A'},
  {rude:'4198006520141018',ci:'15577881',nombre:'ZEBALLOS MAMANI CAROL YESSENIA',gender:'F',fecha:'29 de dic. de 2008',grade:6,parallel:'A'},
  {rude:'4198007120132444',ci:'12446202',nombre:'ZENTENO FIGUEROA ANNALEE GENESIS',gender:'F',fecha:'23 de mar. de 2009',grade:6,parallel:'A'},
  // ── GRADO 6 · PARALELO B ──────────────────────────────────────────────────
  {rude:'4198002120146159',ci:'14611224',nombre:'ALEJANDRO COPA REBECA',gender:'F',fecha:'4 de set. de 2008',grade:6,parallel:'B'},
  {rude:'419800212012265',ci:'17247667',nombre:'ALVIS SARACHO JUAN ERNESTO',gender:'M',fecha:'8 de abr. de 2008',grade:6,parallel:'B'},
  {rude:'419800212013327',ci:'14016278',nombre:'ASILLO CONDORI YASMINKA',gender:'F',fecha:'5 de dic. de 2008',grade:6,parallel:'B'},
  {rude:'81981398201383',ci:'14277772',nombre:'CORONADO VARGAS SAID CASIANO',gender:'M',fecha:'7 de ene. de 2009',grade:6,parallel:'B'},
  {rude:'419800212014613A',ci:'13668119',nombre:'DURAN ALARCON DIEGO',gender:'M',fecha:'23 de dic. de 2008',grade:6,parallel:'B'},
  {rude:'4198007120135883',ci:'15808122',nombre:'EGUEZ MAMANI HERLAN YAMIL',gender:'M',fecha:'8 de feb. de 2008',grade:6,parallel:'B'},
  {rude:'419800212013402',ci:'14030267',nombre:'FERNANDEZ CABRERA RODRIGO',gender:'M',fecha:'15 de nov. de 2008',grade:6,parallel:'B'},
  {rude:'41980021201392',ci:'13691609',nombre:'FLORES PUMA MARK HENRY',gender:'M',fecha:'13 de set. de 2008',grade:6,parallel:'B'},
  {rude:'419800212013439',ci:'16942230',nombre:'FLORES MAMANI NIKOL ANGELYN',gender:'F',fecha:'9 de set. de 2008',grade:6,parallel:'B'},
  {rude:'419800212013124',ci:'15741305',nombre:'GUTIERREZ ROMERO JHONATAN CHARLY',gender:'M',fecha:'24 de set. de 2008',grade:6,parallel:'B'},
  {rude:'419800212013150',ci:'14681911',nombre:'JIMENEZ PEREYRA ANGEL DANIEL',gender:'M',fecha:'7 de nov. de 2008',grade:6,parallel:'B'},
  {rude:'4198000720131077',ci:'12921336',nombre:'JORDAN MANSILLA EXNAIDER',gender:'M',fecha:'6 de ago. de 2008',grade:6,parallel:'B'},
  {rude:'4198002120146288',ci:'15418321',nombre:'LARA TECO CAROLINY',gender:'F',fecha:'25 de dic. de 2008',grade:6,parallel:'B'},
  {rude:'41980021201391A',ci:'14281899',nombre:'LIMON LEON ALEXANDER',gender:'M',fecha:'29 de mar. de 2008',grade:6,parallel:'B'},
  {rude:'4198002120146292',ci:'15756921',nombre:'LLANOS LIMA MARIA ESTEFANY',gender:'F',fecha:'1 de jul. de 2008',grade:6,parallel:'B'},
  {rude:'419800212013491',ci:'15460902',nombre:'LOAYZA COIMBRA CHAMEL',gender:'M',fecha:'7 de ago. de 2008',grade:6,parallel:'B'},
  {rude:'4198002120146326',ci:'15068328',nombre:'LOPEZ LARA ARIANY NICOL',gender:'F',fecha:'25 de jun. de 2009',grade:6,parallel:'B'},
  {rude:'419800212013514',ci:'14503613',nombre:'MAMANI MONTAÑO ANA SHUELLY',gender:'F',fecha:'14 de set. de 2008',grade:6,parallel:'B'},
  {rude:'4198007220131281',ci:'14780228',nombre:'MARTINEZ FLORES SEBASTIAN',gender:'M',fecha:'7 de ene. de 2009',grade:6,parallel:'B'},
  {rude:'419800212012398',ci:'12382981',nombre:'MATURANO ORIAS YESSENIA',gender:'F',fecha:'3 de oct. de 2007',grade:6,parallel:'B'},
  {rude:'419800212013192',ci:'13484398',nombre:'MIRANDA SEGARRA DIEGO',gender:'M',fecha:'22 de dic. de 2008',grade:6,parallel:'B'},
  {rude:'419800212013215',ci:'13429585',nombre:'MORALES SILES NAYARA',gender:'F',fecha:'29 de nov. de 2008',grade:6,parallel:'B'},
  {rude:'8186000420134785',ci:'12824032',nombre:'ORIAS RODRIGUEZ LUKAS ZAHID',gender:'M',fecha:'5 de nov. de 2008',grade:6,parallel:'B'},
  {rude:'4198003120123133',ci:'11376268',nombre:'PADILLA ROMERO ROMEL',gender:'M',fecha:'25 de nov. de 2007',grade:6,parallel:'B'},
  {rude:'419800262013771',ci:'11302575',nombre:'PRADO MORALES ARLETH SMITH',gender:'F',fecha:'14 de jul. de 2007',grade:6,parallel:'B'},
  {rude:'419800212013561',ci:'13302498',nombre:'SALAZAR ARATEA OSMAR',gender:'M',fecha:'21 de abr. de 2009',grade:6,parallel:'B'},
  {rude:'419800212012489',ci:'17019873',nombre:'SANCHEZ CUELLAR EVANS DONOVAN',gender:'M',fecha:'23 de ene. de 2008',grade:6,parallel:'B'},
  {rude:'4198007220131258',ci:'12356700',nombre:'TOLEDO ESPINOZA YORGELY VIANNEY',gender:'F',fecha:'4 de ago. de 2008',grade:6,parallel:'B'},
  {rude:'419800212013278',ci:'15605419',nombre:'TORRICO GONZALES MATEO',gender:'M',fecha:'18 de may. de 2009',grade:6,parallel:'B'},
  {rude:'419800212013306',ci:'13366232',nombre:'VARGAS VELA LUZ BELEN',gender:'F',fecha:'6 de set. de 2008',grade:6,parallel:'B'},
  // ── GRADO 6 · PARALELO C ──────────────────────────────────────────────────
  {rude:'4198002120146106',ci:'11309858',nombre:'ACUÑA AIZA LUIS MIGUEL',gender:'M',fecha:'20 de may. de 2009',grade:6,parallel:'C'},
  {rude:'4198002120146618',ci:'9832182',nombre:'ACUÑA SALINAS LIDCEN',gender:'F',fecha:'18 de abr. de 2009',grade:6,parallel:'C'},
  {rude:'4198002120146110',ci:'13691581',nombre:'ALCARAZ APAZA NELLY MICHEL',gender:'F',fecha:'16 de set. de 2008',grade:6,parallel:'C'},
  {rude:'4198002120131183',ci:'13691517',nombre:'ARANCIBIA ALCARAZ ALVARO',gender:'M',fecha:'21 de abr. de 2008',grade:6,parallel:'C'},
  {rude:'419800212014657A',ci:'14282009',nombre:'BARAHONA CRUZ MARIELA',gender:'F',fecha:'22 de feb. de 2009',grade:6,parallel:'C'},
  {rude:'4198002120146201',ci:'14283265',nombre:'CARTAGENA VALVERDE MAGDIEL',gender:'M',fecha:'24 de mar. de 2009',grade:6,parallel:'C'},
  {rude:'419800212013353',ci:'16918089',nombre:'CASTILLO LAQUE JUAN JOSE',gender:'M',fecha:'22 de jun. de 2009',grade:6,parallel:'C'},
  {rude:'6190001420132074',ci:'15211925',nombre:'CHEMO HUISA ELDA',gender:'F',fecha:'5 de jul. de 2008',grade:6,parallel:'C'},
  {rude:'41980021201363',ci:'13985983',nombre:'CHILO FERNANDEZ ANGELYNE YULEIDY',gender:'F',fecha:'12 de set. de 2008',grade:6,parallel:'C'},
  {rude:'4198002120146220',ci:'13434974',nombre:'CHOQUE CHOQUE IVER',gender:'M',fecha:'19 de mar. de 2009',grade:6,parallel:'C'},
  {rude:'419800212013374',ci:'13742286',nombre:'CRUZ VALLEJOS GABRIELA',gender:'F',fecha:'16 de jun. de 2009',grade:6,parallel:'C'},
  {rude:'4198002820143503',ci:'16571095',nombre:'CUSSI VALLEJOS CARLOS DANIEL',gender:'M',fecha:'11 de dic. de 2008',grade:6,parallel:'C'},
  {rude:'4198002120146599',ci:'15752554',nombre:'DONAIRE VASQUEZ JEIDY',gender:'F',fecha:'5 de set. de 2008',grade:6,parallel:'C'},
  {rude:'419800212013119',ci:'13690143',nombre:'GUTIERREZ DURAN SAMIR YANDEL',gender:'M',fecha:'9 de ene. de 2009',grade:6,parallel:'C'},
  {rude:'419800212014668A',ci:'14571535',nombre:'HURTADO HERRERA MAITANE',gender:'F',fecha:'15 de dic. de 2008',grade:6,parallel:'C'},
  {rude:'4198002120131547',ci:'16333036',nombre:'MARISCAL FLORES JOSE DAVID',gender:'M',fecha:'8 de jun. de 2008',grade:6,parallel:'C'},
  {rude:'41980021201352A',ci:'14283376',nombre:'MOJICA MONTERO YARITZA',gender:'F',fecha:'20 de ene. de 2009',grade:6,parallel:'C'},
  {rude:'41980027201481',ci:'14941193',nombre:'MORALES CEREZO ARIO KEYLER',gender:'M',fecha:'3 de abr. de 2009',grade:6,parallel:'C'},
  {rude:'4198009120142025',ci:'14826222',nombre:'RAMOS VILLARPANDO CARLA PATRICIA',gender:'F',fecha:'21 de dic. de 2008',grade:6,parallel:'C'},
  {rude:'519800202013381',ci:'15234493',nombre:'RIOS VIDAL NORAH SOFIA',gender:'F',fecha:'17 de dic. de 2008',grade:6,parallel:'C'},
  {rude:'4198007120132592',ci:'14611504',nombre:'ROCHA RODRIGUEZ NURIAN',gender:'F',fecha:'11 de may. de 2009',grade:6,parallel:'C'},
  {rude:'419800262014919',ci:'14605825',nombre:'ROMERO SERRUDO ANYELINE',gender:'F',fecha:'11 de mar. de 2009',grade:6,parallel:'C'},
  {rude:'8198109120142367',ci:'14773833',nombre:'SAAVEDRA SANDOVAL CARLOS DANIEL',gender:'M',fecha:'26 de abr. de 2009',grade:6,parallel:'C'},
  {rude:'4198002120146421',ci:'11312255',nombre:'SAUZA ARIAS RUTH FERNANDA',gender:'F',fecha:'24 de nov. de 2008',grade:6,parallel:'C'},
  {rude:'519800642011542',ci:'13484971',nombre:'TERAN RENGIPO KEVIN',gender:'M',fecha:'4 de dic. de 2006',grade:6,parallel:'C'},
  {rude:'419800212013283',ci:'13336197',nombre:'VALBERDE SALAZAR ESMERALDA BELEN',gender:'F',fecha:'27 de mar. de 2009',grade:6,parallel:'C'},
  {rude:'419800212013577',ci:'11305932',nombre:'YUCRA MAMANI ELIAS',gender:'M',fecha:'21 de abr. de 2009',grade:6,parallel:'C'},
]

// ── Lógica principal ──────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Sincronización de estudiantes PDF 2026 → DB`)
  console.log(`   ${PDF_STUDENTS.length} estudiantes en el PDF\n`)

  // Año académico 2026
  const academicYear = await prisma.academicYear.findFirst({ where: { year: 2026 } })
  if (!academicYear) {
    console.error('❌ No existe AcademicYear 2026 en la DB. Créalo primero.')
    process.exit(1)
  }

  // Cache de cursos SECUNDARIA MORNING
  const courseCache: Record<string, any> = {}
  const getCourse = async (grade: number, parallel: string) => {
    const key = `${grade}-${parallel}`
    if (courseCache[key]) return courseCache[key]
    const c = await prisma.course.findFirst({
      where: {
        level:    'SECUNDARIA' as any,
        grade:    GRADOS[grade] as any,
        parallel: parallel as any,
        shift:    'MORNING' as any,
      }
    })
    if (c) courseCache[key] = c
    return c
  }

  let updated = 0, created = 0, noCreated = 0, errors = 0
  const nuevos: string[] = []
  let i = 0

  for (const s of PDF_STUDENTS) {
    i++
    if (i % 50 === 0 || i === 1) {
      process.stdout.write(`\r   Procesando ${i}/${PDF_STUDENTS.length}... `)
    }
    try {
      const { lastName, firstName } = parseName(s.nombre)
      const birthDate = parseFecha(s.fecha)
      const gender    = s.gender === 'M' ? 'MASCULINO' : 'FEMENINO'

      // 1. Buscar estudiante existente por CI o RUDE
      let student = await prisma.student.findFirst({
        where: { OR: [{ ci: s.ci }, { rude: s.rude }] }
      })

      if (student) {
        // ── Actualizar datos del PDF ────────────────────────────────────────
        await prisma.student.update({
          where: { id: student.id },
          data: {
            rude:      s.rude,
            ci:        s.ci        || student.ci,
            gender:    gender      as any,
            birthDate: birthDate   ?? student.birthDate,
          },
        })
        updated++

        // Verificar/crear asignación al curso 2026
        const course = await getCourse(s.grade, s.parallel)
        if (course) {
          const existing = await prisma.studentAcademicAssignment.findFirst({
            where: { studentId: student.id, academicYearId: academicYear.id }
          })
          if (!existing) {
            await prisma.studentAcademicAssignment.create({
              data: {
                studentId:     student.id,
                courseId:      course.id,
                academicYearId: academicYear.id,
                year:          2026,
                educationType: 'REGULAR' as any,
              }
            })
          } else if (existing.courseId !== course.id) {
            // Actualizar al curso correcto según el PDF
            await prisma.studentAcademicAssignment.update({
              where: { id: existing.id },
              data:  { courseId: course.id }
            })
          }
        }

      } else {
        // ── Crear nuevo estudiante ──────────────────────────────────────────
        const course = await getCourse(s.grade, s.parallel)
        if (!course) {
          console.warn(`  ⚠️  Curso no encontrado: ${GRADOS[s.grade]} ${s.parallel} — ${s.nombre}`)
          noCreated++
          continue
        }

        const newStudent = await prisma.student.create({
          data: {
            firstName,
            lastName,
            ci:        s.ci        || null,
            rude:      s.rude,
            gender:    gender      as any,
            birthDate: birthDate   ?? null,
            isActive:  true,
          },
        })

        await prisma.studentAcademicAssignment.create({
          data: {
            studentId:     newStudent.id,
            courseId:      course.id,
            academicYearId: academicYear.id,
            year:          2026,
            educationType: 'REGULAR' as any,
          }
        })

        nuevos.push(`  + ${s.nombre} → ${GRADOS[s.grade]} ${s.parallel}`)
        created++
      }

    } catch (err: any) {
      console.error(`  ❌ Error con ${s.nombre}: ${err.message}`)
      errors++
    }
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log(`✅ Actualizados: ${updated}`)
  console.log(`🆕 Creados:      ${created}`)
  console.log(`⚠️  Sin curso:    ${noCreated}`)
  console.log(`❌ Errores:      ${errors}`)
  console.log('═'.repeat(60))

  if (nuevos.length > 0) {
    console.log('\n🆕 ESTUDIANTES NUEVOS CREADOS:')
    nuevos.forEach(n => console.log(n))
  }
}

main()
  .catch(e => { console.error('Error fatal:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())