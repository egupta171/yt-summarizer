// app/opengraph-image.tsx
import { ImageResponse } from "next/og";
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OGImage() {
  return new ImageResponse(
    (<div style={{height:"100%",width:"100%",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",background:"linear-gradient(135deg,#000,#0b1220 60%,#0d1424)",color:"white",fontSize:56,fontWeight:700}}>
      <div style={{fontSize:24,opacity:.8,letterSpacing:2,textTransform:"uppercase",marginBottom:18}}>Vedyug Daily</div>
      <div style={{textAlign:"center",maxWidth:900,lineHeight:1.15}}>Vedyug AI<span style={{color:"#8ff0c6"}}> — actionable notes from YouTube</span></div>
      <div style={{fontSize:24,opacity:.8,marginTop:18}}>Paste a link → get key takeaways & timestamps</div>
    </div>),
    { ...size }
  );
}
