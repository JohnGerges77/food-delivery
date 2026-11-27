// Local read-only fixture. No database connection or order writes.
import { createServer } from 'node:http';
const categoryId='507f1f77bcf86cd799439010';
const variants=[{id:'507f1f77bcf86cd799439012',name:'Small',price:20,isAvailable:true,sortOrder:0},{id:'507f1f77bcf86cd799439013',name:'Large',price:35,isAvailable:true,sortOrder:1},{id:'507f1f77bcf86cd799439014',name:'Unavailable',price:10,isAvailable:false,sortOrder:2}];
const products=[{id:'507f1f77bcf86cd799439011',categoryId,name:'Pizza',slug:'pizza',description:'First line\nSecond line',price:1,oldPrice:50,imageUrl:'/best1.webp',images:['/best2.webp'],isFeatured:true,preparationTime:20,calories:450,variants,startingPrice:20},
 {id:'507f1f77bcf86cd799439015',categoryId,name:'Legacy',slug:'legacy',description:'Regular product',price:12,oldPrice:null,imageUrl:'/best3.webp',images:[],isFeatured:false,preparationTime:null,calories:null}];
createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');
  if(req.method!=='GET'){res.writeHead(405).end('{}');return;}
  const url=new URL(req.url,'http://localhost');
  const match=url.pathname.match(/^\/api\/public\/restaurants\/variant-(classic|aqua|cafe|luxury)(.*)$/);
  if(!match){res.writeHead(404).end('{}');return;}
  const [,theme,path]=match;const slug=`variant-${theme}`;
  const restaurant={name:`Variants ${theme}`,slug,storefrontTheme:`savora-${theme}`,description:'Local verification',logoUrl:null,currency:'EGP',phone:null,contactEmail:null,address:null,openingHours:null,deliverySettings:{deliveryFee:5,minimumOrder:0,estimatedDeliveryTime:null,deliveryAvailable:true},socialLinks:{facebook:null,instagram:null,whatsapp:'https://wa.me/201000000000'},branding:{brandName:null,primaryColor:null}};
  if(!path)res.end(JSON.stringify({restaurant}));
  else if(path==='/categories')res.end(JSON.stringify({categories:[{id:categoryId,name:'Meals',slug:'meals',description:null,imageUrl:null,sortOrder:0}],pagination:{page:1,limit:100,total:1,hasNext:false}}));
  else if(path==='/products'){const list=url.searchParams.get('isFeatured')==='true'?products.filter(p=>p.isFeatured):products;res.end(JSON.stringify({currency:'EGP',products:list,pagination:{page:1,limit:100,total:list.length,hasNext:false}}));}
  else if(path.startsWith('/products/')){const product=products.find(p=>p.id===path.slice(10));res.writeHead(product?200:404).end(JSON.stringify({product,category:{id:categoryId,name:'Meals',slug:'meals',description:null,imageUrl:null,sortOrder:0}}));}
  else res.writeHead(404).end('{}');
}).listen(5179,'127.0.0.1',()=>console.log('Read-only variant visual API: 5179'));
