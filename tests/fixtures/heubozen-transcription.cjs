// Transcription MANUELLE de l'aperçu fourni le 13/11/2026 (1080 × 1440).
// Ceci n'est PAS la sortie Tesseract de la photo, ni un fichier photo original.
// Boîtes approximatives permettant de tester l'association spatiale et la sémantique.
const words=[
 ['TIME/500M',235,444,326,464],['SPM',368,445,405,466],['PULSE',477,446,529,468],['5kHz',536,447,579,469],['TIME',605,448,649,470],['METERS',750,449,824,471],
 ['0:00',230,473,333,532],['0',388,473,420,534],['---',443,490,530,517],['10:08',579,475,698,537],['1449',734,478,854,540],
 ['LEVEL',254,546,312,567],['STROKES',740,554,834,576],['6',285,576,317,631],['232',746,583,852,644],
 ['WATTS',254,646,316,668],['CALORIES',738,656,834,678],['0',301,674,335,733],['PAUSE',348,677,559,737],['78',786,682,845,740]
].map(([text,x0,y0,x1,y1])=>({text,confidence:95,bbox:{x0,y0,x1,y1}}));
module.exports={text:'TIME/500M SPM PULSE 5kHz TIME METERS\n0:00 0 --- 10:08 1449\nLEVEL STROKES\n6 232\nWATTS CALORIES\n0 PAUSE 78',confidence:38,words};
