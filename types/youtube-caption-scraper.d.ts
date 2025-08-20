declare module "youtube-captions-scraper" {
    export interface Subtitle {
      start: number; // seconds
      dur: number;   // seconds
      text: string;
    }
  
    export function getSubtitles(args: {
      videoID: string;
      lang?: string;
    }): Promise<Subtitle[]>;
  }
  