const adjectives = [
  "quick", "lazy", "happy", "sad", "brave", "calm", "eager", "fierce",
  "gentle", "jolly", "kind", "lively", "merry", "noble", "proud",
  "silly", "witty", "bold", "clever", "daring"
];

const nouns = [
  "fox", "bear", "wolf", "hawk", "deer", "owl", "lion", "tiger",
  "whale", "eagle", "otter", "panda", "raven", "shark", "snake",
  "falcon", "badger", "crane", "moose", "bison"
];

export function generateGameId() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}-${noun}-${num}`;
}
