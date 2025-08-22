// app/twitter-image.tsx
import { ImageResponse } from "next/og";
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function TwitterImage() {
  return new ImageResponse(
    (<div style={{height:"100%",width:"100%",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",background:"radial-gradient(100% 100% at 0% 0%,#182236 0%,#0b1220 60%,#0d1424 100%)",color:"white",fontSize:60,fontWeight:800}}>
      <div style={{fontSize:26,opacity:.8,marginBottom:14}}>YT Summarizer</div>
      <div style={{textAlign:"center",maxWidth:900,lineHeight:1.15}}>Turn any YouTube into <span style={{color:"#8ff0c6"}}>actionable notes</span></div>
      <div style={{fontSize:24,opacity:.8,marginTop:14}}>10 free credits on sign-up</div>
    </div>),
    { ...size }
  );
}
