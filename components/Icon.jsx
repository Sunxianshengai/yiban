'use client';
// 图标系统：统一接入 Lucide（ISC 开源线性图标库），视觉与「暖白画布 + 深松绿」设计语言一致。
// 对外 API 保持不变：<Icon name size className {...rest}/>；未知名称回退到 Heart。
import {
  Activity,Album,Archive,ArrowLeft,ArrowRight,ArrowUp,Bell,BookOpen,Cake,Calendar,Camera,Check,ChevronDown,ChevronRight,Copy,MoreHorizontal,PanelLeft,Square,ThumbsDown,
  ChevronsLeft,ChevronsRight,CirclePlay,Clapperboard,Clock,Coins,Download,Eye,GalleryHorizontalEnd,
  Headphones,Heart,HeartHandshake,Hourglass,House,Image as ImageIcon,Info,LayoutGrid,Leaf,
  Library,Lightbulb,List,Lock,LockOpen,LogOut,MapPin,MessageSquare,MessagesSquare,Mic,Moon,
  Music,Pause,PenLine,Play,Plus,Repeat,Search,Settings,Shield,ShieldCheck,SkipBack,SkipForward,
  Smile,Sparkles,Sprout,SquarePen,Sun,Star,ThumbsUp,Trash2,Upload,UserRound,Users,Volume2,Waypoints,X,
} from 'lucide-react';

const icons = {
  // 既有名称（沿用全站调用点）
  home:House, library:Library, upload:Upload, album:GalleryHorizontalEnd, people:Users,
  heart:Heart, activity:Activity, settings:Settings, arrow:ArrowRight, chevron:ChevronRight,
  back:ArrowLeft, plus:Plus, close:X, search:Search, mic:Mic, play:Play, pause:Pause,
  volume:Volume2, image:ImageIcon, calendar:Calendar, clock:Clock, pin:MapPin, sparkle:Sparkles,
  check:Check, edit:SquarePen, trash:Trash2, message:MessageSquare, leaf:Leaf, bell:Bell,
  repeat:Repeat, book:BookOpen, download:Download, shield:Shield, sun:Sun, logout:LogOut,
  grid:LayoutGrid, list:List, info:Info, roles:Smile,
  // 首页重设计与后续页面新增
  coins:Coins, cake:Cake, hourglass:Hourglass, waypoints:Waypoints, sprout:Sprout,
  'messages-square':MessagesSquare, 'heart-handshake':HeartHandshake, headphones:Headphones,
  'thumbs-up':ThumbsUp, camera:Camera, clapperboard:Clapperboard, 'pen-line':PenLine,
  'skip-back':SkipBack, 'skip-forward':SkipForward, lock:Lock, 'lock-open':LockOpen,
  lightbulb:Lightbulb, music:Music, 'chevrons-left':ChevronsLeft, 'chevrons-right':ChevronsRight,
  star:Star, moon:Moon, eye:Eye, 'circle-play':CirclePlay, 'shield-check':ShieldCheck,
  user:UserRound,archive:Archive,copy:Copy,more:MoreHorizontal,panel:PanelLeft,stop:Square,send:ArrowUp,down:ChevronDown,'thumbs-down':ThumbsDown,
};

export default function Icon({name,size=20,className='',...rest}) {
  const Component=icons[name]||Heart;
  return <Component size={size} strokeWidth={1.7} className={className} aria-hidden="true" {...rest}/>;
}
