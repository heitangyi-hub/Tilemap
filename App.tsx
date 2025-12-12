import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Settings, 
  Download, 
  Scissors, 
  Grid3X3, 
  Layers, 
  Image as ImageIcon,
  AlertCircle,
  Eye,
  EyeOff,
  FileJson,
  ZoomIn,
  ZoomOut,
  Grid // 引入 Grid 图标
} from 'lucide-react';
import { processImage, ProcessResult } from './services/tileProcessor';
import { Button } from './components/Button';

// 默认配置
const DEFAULT_TILE_SIZE = 48;

const App: React.FC = () => {
  // State
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<string>("");
  
  const [tileSize, setTileSize] = useState<number>(DEFAULT_TILE_SIZE);
  const [mode, setMode] = useState<'original' | 'optimized'>('original');
  const [showCollision, setShowCollision] = useState<boolean>(false);
  
  // 新增状态：缩放、拖拽、网格显示
  const [zoom, setZoom] = useState<number>(1.0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 通用文件处理函数
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError("请上传 PNG 或 JPG 格式的图片");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setFileName(file.name.split('.')[0]); // 去掉后缀
        setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
        setResult(null); // 重置结果
        setError(null);
        setShowCollision(false); // 重置显示状态
        setZoom(1.0); // 重置缩放
        // 保持网格状态不变，方便连续处理
      };
      img.onerror = () => setError("图片加载失败，文件可能已损坏");
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 处理 input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // 处理拖拽事件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // 执行切片逻辑
  const handleProcess = useCallback(async () => {
    if (!sourceImage) return;
    
    setIsProcessing(true);
    setError(null);

    // 给 UI 一点渲染 loading 的时间
    setTimeout(async () => {
      try {
        const res = await processImage(sourceImage, {
          tileSize,
          mode,
          columns: 8 // 固定 8 列
        });
        setResult(res);
      } catch (err: any) {
        setError(err.message || "处理过程中发生未知错误");
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  }, [sourceImage, tileSize, mode]);

  // 触发文件选择
  const triggerUpload = () => fileInputRef.current?.click();

  // 下载函数
  const handleDownload = (type: 'png' | 'json') => {
    if (!result) return;
    const link = document.createElement('a');
    
    if (type === 'png') {
      link.download = `${fileName}_${mode}_tileset.png`;
      link.href = result.dataUrl;
    } else {
      link.download = `${fileName}_${mode}_data.json`;
      const blob = new Blob([result.jsonContent], { type: 'application/json' });
      link.href = URL.createObjectURL(blob);
    }
    
    link.click();
  };

  return (
    <div className="flex h-screen w-full bg-neutral-900 text-gray-200">
      
      {/* --- 左侧侧边栏：控制面板 --- */}
      <aside className="w-80 flex-shrink-0 border-r border-neutral-700 flex flex-col bg-neutral-800/50 backdrop-blur-sm">
        
        {/* 标题 */}
        <div className="p-6 border-b border-neutral-700 bg-neutral-900/50">
          <h1 className="text-xl font-bold flex items-center gap-2 text-blue-400">
            <Scissors className="w-6 h-6" />
            <span>TileSlicer Pro</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1">瓦片地图 (Tilemap)小工具</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* 1. 上传区域 (支持拖拽) */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-4 h-4" /> 1. 图片源
            </h2>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/png, image/jpeg" 
              onChange={handleFileChange}
            />

            <div 
              onClick={triggerUpload}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200
                ${isDragging 
                  ? 'border-blue-400 bg-blue-500/20 scale-[1.02]' 
                  : sourceImage 
                    ? 'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20' 
                    : 'border-neutral-600 hover:border-neutral-500 hover:bg-neutral-700/50'}
              `}
            >
              {sourceImage ? (
                <div className="space-y-2 pointer-events-none">
                  <div className="w-16 h-16 bg-neutral-900 rounded-lg mx-auto overflow-hidden border border-neutral-600 flex items-center justify-center">
                    <img src={sourceImage.src} className="max-w-full max-h-full object-contain" alt="preview" />
                  </div>
                  <div className="text-sm font-medium text-blue-300 truncate px-2">{fileName}</div>
                  <div className="text-xs text-neutral-400">
                    {sourceImage.width}x{sourceImage.height} px • {fileSize}
                  </div>
                  <div className="text-xs text-blue-400/80">点击或拖拽更换</div>
                </div>
              ) : (
                <div className="space-y-2 py-4 pointer-events-none">
                  <ImageIcon className="w-8 h-8 mx-auto text-neutral-500" />
                  <div className="text-sm font-medium text-neutral-300">
                    {isDragging ? '释放以上传' : '点击或拖拽上传'}
                  </div>
                  <p className="text-xs text-neutral-500">支持 PNG/JPG (无尺寸限制)</p>
                </div>
              )}
            </div>
          </section>

          {/* 2. 参数设置 */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4" /> 2. 切片参数
            </h2>

            {/* 尺寸输入 */}
            <div className="space-y-2">
              <label className="text-sm text-neutral-300 flex justify-between">
                <span>网格尺寸 (px)</span>
                <span className="text-xs bg-neutral-700 px-2 py-0.5 rounded text-neutral-400">默认 48</span>
              </label>
              <div className="flex items-center gap-2 bg-neutral-900 rounded-lg border border-neutral-700 px-3 py-2">
                <Grid3X3 className="w-4 h-4 text-neutral-500" />
                <input 
                  type="number" 
                  value={tileSize}
                  onChange={(e) => setTileSize(Math.max(1, parseInt(e.target.value) || 48))}
                  className="bg-transparent border-none outline-none text-sm w-full font-mono text-blue-300"
                />
              </div>
              <p className="text-xs text-neutral-500">
                会自动计算每个格子的像素密度来生成碰撞数据。
              </p>
            </div>

            {/* 模式选择 */}
            <div className="space-y-3 pt-2">
              <label className="text-sm text-neutral-300">排版模式</label>
              
              {/* 模式 1: 完整保留 */}
              <label className={`
                flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                ${mode === 'original' 
                  ? 'bg-blue-600/10 border-blue-500' 
                  : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'}
              `}>
                <input 
                  type="radio" 
                  name="mode" 
                  checked={mode === 'original'}
                  onChange={() => setMode('original')}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-200">1. 完整排列 (Map View)</div>
                  <div className="text-xs text-neutral-400 leading-relaxed">
                    仅裁剪边缘。生成 1:1 的地图数据。适合整张大地图背景。
                  </div>
                </div>
              </label>

              {/* 模式 2: 智能去重 */}
              <label className={`
                flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                ${mode === 'optimized' 
                  ? 'bg-blue-600/10 border-blue-500' 
                  : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'}
              `}>
                <input 
                  type="radio" 
                  name="mode" 
                  checked={mode === 'optimized'}
                  onChange={() => setMode('optimized')}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-200">2. 智能图集 (Sprite Sheet)</div>
                  <div className="text-xs text-neutral-400 leading-relaxed">
                    自动去重。生成紧凑素材包 + 瓦片定义数据。适合 TileSet。
                  </div>
                </div>
              </label>
            </div>
          </section>

          {/* Action Button */}
          <div className="pt-4">
             <Button 
                onClick={handleProcess} 
                disabled={!sourceImage || isProcessing}
                className="w-full py-3 text-sm"
              >
                {isProcessing ? '处理计算中...' : (result ? '重新生成' : '开始切片 + 计算碰撞')}
             </Button>
          </div>
        </div>

        {/* 底部 Footer */}
        <div className="p-4 border-t border-neutral-700 text-[10px] text-neutral-600 text-center">
          TileSlicer v1.2.0 • Auto Collision • Zoom
        </div>
      </aside>

      {/* --- 右侧主区域：预览 --- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900 relative">
        
        {/* 顶部工具栏 */}
        <header className="h-16 border-b border-neutral-700 flex items-center justify-between px-6 bg-neutral-800/80 backdrop-blur">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-gray-200 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-500" />
              输出预览
            </h2>
            {result && (
              <span className="text-xs bg-neutral-700 text-blue-300 px-2 py-1 rounded-md font-mono">
                {result.width} x {result.height} px
              </span>
            )}
          </div>

          <div className="flex items-center">
            {/* 缩放控件 */}
            {(result || sourceImage) && (
               <div className="flex items-center gap-2 mr-6 border-r border-neutral-700 pr-6">
                 <ZoomOut className="w-4 h-4 text-neutral-500" />
                 <input 
                    type="range" 
                    min="0.2" 
                    max="3" 
                    step="0.1" 
                    value={zoom} 
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-24 h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                 />
                 <ZoomIn className="w-4 h-4 text-neutral-500" />
                 <span className="text-xs font-mono text-neutral-400 w-10 text-right">
                   {Math.round(zoom * 100)}%
                 </span>
               </div>
            )}

            {/* 工具按钮栏 */}
            {(result || sourceImage) && (
              <div className="flex items-center gap-3">
                 {/* 网格开关 */}
                 <Button 
                  onClick={() => setShowGrid(!showGrid)}
                  variant="secondary"
                  className={`text-xs px-3 py-1.5 ${showGrid ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : ''}`}
                  icon={<Grid className="w-4 h-4"/>}
                  title="显示/隐藏网格辅助线"
                >
                  网格线
                </Button>

                {result && (
                  <>
                    <Button 
                      onClick={() => setShowCollision(!showCollision)}
                      variant="secondary"
                      className={`text-xs px-3 py-1.5 ${showCollision ? 'bg-red-900/50 border-red-800 text-red-200' : ''}`}
                      icon={showCollision ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                      title="查看自动生成的碰撞区域"
                    >
                      碰撞预览
                    </Button>

                    <div className="h-6 w-px bg-neutral-700 mx-2"></div>

                    <Button 
                      variant="secondary"
                      icon={<FileJson className="w-4 h-4" />}
                      onClick={() => handleDownload('json')}
                      title="下载包含碰撞信息的数据文件"
                    >
                      JSON
                    </Button>
                    
                    <Button 
                      variant="primary"
                      icon={<Download className="w-4 h-4" />}
                      onClick={() => handleDownload('png')}
                    >
                      PNG
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* 预览画布区域 */}
        <div className="flex-1 overflow-auto p-8 flex items-start justify-center checkerboard relative">
          
          {error && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-3 shadow-xl z-50">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {!result && !sourceImage && (
            <div className="mt-32 flex flex-col items-center text-neutral-600 space-y-4">
              <div className="w-20 h-20 border-2 border-dashed border-neutral-700 rounded-2xl flex items-center justify-center">
                <Grid3X3 className="w-8 h-8 opacity-50" />
              </div>
              <p>请先在左侧上传图片并配置参数</p>
            </div>
          )}

          {/* 渲染图片或结果 */}
          {(result || sourceImage) && (
            <div 
              className="relative shadow-2xl shadow-black/50 bg-transparent group select-none transition-all duration-200 ease-out origin-top-left flex-shrink-0" // 关键修改: flex-shrink-0
              style={{
                // 使用 CSS 宽高控制缩放，确保滚动条逻辑正确
                width: (result ? result.width : (sourceImage?.width || 0)) * zoom,
                height: (result ? result.height : (sourceImage?.height || 0)) * zoom
              }}
            >
               {/* 结果图片 */}
               <img 
                 src={result ? result.dataUrl : sourceImage?.src} 
                 alt="Preview" 
                 className="block w-full h-full pixelated relative z-0 max-w-none" // 关键修改: max-w-none
                 style={{ imageRendering: 'pixelated' }}
               />

               {/* 网格辅助线 Overlay */}
               {showGrid && (
                 <div 
                   className="absolute inset-0 pointer-events-none z-10"
                   style={{
                     backgroundSize: `${tileSize * zoom}px ${tileSize * zoom}px`,
                     backgroundImage: `
                       linear-gradient(to right, rgba(255, 255, 255, 0.3) 1px, transparent 1px),
                       linear-gradient(to bottom, rgba(255, 255, 255, 0.3) 1px, transparent 1px)
                     `
                   }}
                 />
               )}
               
               {/* 碰撞预览层 (Overlay) - 仅在有结果且开启时显示 */}
               {result && showCollision && (
                 <div className="absolute inset-0 pointer-events-none z-20">
                   {result.tiles.filter(t => t.isSolid).map(tile => (
                     <div 
                        key={tile.id}
                        className="absolute bg-red-500/40 border border-red-400/60"
                        style={{
                          left: tile.x * zoom,
                          top: tile.y * zoom,
                          width: tileSize * zoom,
                          height: tileSize * zoom
                        }}
                     >
                        {/* 只有在缩放比例足够大时才显示 ID，避免太乱 */}
                        {zoom >= 0.8 && (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-white font-mono opacity-80" style={{ fontSize: `${10 * zoom}px`}}>
                            {tile.id}
                          </div>
                        )}
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default App;