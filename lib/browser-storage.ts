/** Session storage may be blocked by browser privacy settings. */
const memory=new Map<string,string>();
export const sessionStore={getItem(key:string){try{return sessionStorage.getItem(key)??memory.get(key)??null;}catch{return memory.get(key)??null;}},setItem(key:string,value:string){memory.set(key,value);try{sessionStorage.setItem(key,value);}catch{}},removeItem(key:string){memory.delete(key);try{sessionStorage.removeItem(key);}catch{}}};
