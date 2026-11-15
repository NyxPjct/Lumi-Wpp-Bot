export function Clover({className=''}:{className?:string}){
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 35c9 8 9 15 4 22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>{[0,90,180,270].map((angle,index)=><path key={angle} d="M31 29C23 27 16 21 18 15C20 9 28 10 31 16C34 10 42 9 44 15C46 21 39 27 31 29Z" fill="currentColor" opacity={[1,.88,.72,.9][index]} transform={`rotate(${angle} 31 31)`}/>)}</svg>;
}
