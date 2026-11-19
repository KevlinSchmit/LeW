import * as THREE from 'three';
import { makeSushiPaints } from './paint.js';
import { makeSushiFood } from './shapes.js';

const menu = [
  ['tobiko','Tobiko gunkan'],
  ['ebi','Butterflied shrimp nigiri'],
  ['california','Tobiko-coated California roll'],
  ['unagi','Glazed eel nigiri'],
  ['hotate','Split scallop nigiri'],
  ['uni','Sea urchin gunkan'],
  ['saba','Silver-skinned mackerel nigiri'],
  ['inari','Wakame inari tofu pockets'],
  ['tekka','Tuna hosomaki'],
  ['hokkigai','Surf clam nigiri'],
  ['aburi','Torched gunkan'],
  ['tako','Octopus nigiri'],
  ['philadelphia','Salmon and cream cheese roll'],
  ['negisake','Chopped salmon gunkan'],
  ['temaki','Salmon temaki'],
];

export function matchesTableware(object){
  return object.userData.sushiTableware || isSushiCover(object) ||
    /ink[ _]plate[ _]edge|lacquer|glaze/i.test(object.name);
}

export function isSushiCover(object){
  return object.userData.sushiCover || /(?:^|[^a-z])(?:glass|pet)(?=$|[^a-z])/i.test(object.name);
}

export function createAdditionalServings(originals) {
  const paints=makeSushiPaints();
  return menu.map(([id,description],i)=>{
    const template=originals[i%originals.length];
    const dish=new THREE.Group();
    dish.name='SUSHI_'+id;
    dish.position.copy(template.position);
    dish.userData.sushiKind=id;
    dish.userData.sushiDescription=description;
    const food=makeSushiFood(id,paints);
    // A little presentation variation, held constant as each plate turns.
    food.rotation.y=[.13,-.11,.04,-.16,.105][i%5];
    dish.add(food);
    return dish;
  });
}

export function addSushiMenu(model,plates,dressServing) {
  const originals=plates.slice();
  for(const plate of originals)plate.userData.sushiKind=plate.name.slice(6);
  const additions=createAdditionalServings(originals);
  for(const plate of additions)model.add(plate);
  plates.splice(0,plates.length,
    ...additions.slice(0,4),originals[0],...additions.slice(4,8),originals[1],
    ...additions.slice(8,12),originals[2],...additions.slice(12),originals[3]);
  plates.forEach(dressServing);
}
