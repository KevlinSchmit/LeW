import audio0 from './music/pure-imagination-live.mp3?inline';
import audio1 from './music/only-with-you.mp3?inline';
import audio2 from './music/jazz-is-for-ordinary-people.mp3?inline';
import audio3 from './music/ladyfingers.mp3?inline';
import audio4 from './music/cool-cat.mp3?inline';
import audio5 from './music/massachusetts.mp3?inline';
import audio6 from './music/bali.mp3?inline';
import cover0 from './music/cover-0.jpg?inline';
import cover1 from './music/cover-1.jpg?inline';
import cover2 from './music/cover-2.jpg?inline';
import cover3 from './music/cover-3.jpg?inline';
import cover4 from './music/cover-4.jpg?inline';
import cover5 from './music/cover-5.jpg?inline';
import cover6 from './music/cover-6.jpg?inline';
import source from './music/cozy-ambience-to-relax.mp3?inline';
import artwork from './music/lounge.png?inline';

const ambience={
  title:'vintage jazz on a rainy 1940s night | cozy ambience to relax',
  artist:'Lepreezy',
  duration:2096,
  source, artwork,
};

export const tracks=[
  { title:"Pure Imagination (Live)", artist:"Langston Hughes II", duration:349.728, source:audio0, artwork:cover0 },
  { title:"jazz is for ordinary people", artist:"berlioz", duration:164.04898, source:audio2, artwork:cover2 },
  { title:"Only With You", artist:"山下達郎", duration:223.869388, source:audio1, artwork:cover1 },
  { title:"Ladyfingers", artist:"Mariachi Nueva Luna", duration:106.032, source:audio3, artwork:cover3 },
  { title:"Cool Cat", artist:"Queen", duration:209.031837, source:audio4, artwork:cover4 },
  { title:"Massachusetts", artist:"Bee Gees", duration:142.915918, source:audio5, artwork:cover5 },
  { title:"Bali", artist:"Schoolgirl byebye", duration:167.016, source:audio6, artwork:cover6 },
  ambience,
];
