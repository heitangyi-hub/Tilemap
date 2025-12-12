/**
 * 瓦片处理核心服务
 * 负责图片的切片、哈希比对（去重）以及重新绘制
 */

export interface ProcessOptions {
  tileSize: number;
  mode: 'original' | 'optimized'; // original: 原样保留(仅裁边), optimized: 去重+重排
  columns?: number; // optimized 模式下的列数，默认 8
}

export interface TileData {
  id: number; // 在结果图中的索引 ID
  x: number;  // 在结果图中的 X 坐标
  y: number;  // 在结果图中的 Y 坐标
  isSolid: boolean; // 是否有碰撞体积 (自动推算)
}

export interface ProcessResult {
  dataUrl: string;
  width: number;
  height: number;
  totalTiles: number;
  uniqueTiles: number;
  tiles: TileData[]; // 详细的瓦片数据
  jsonContent: string; // 导出的 JSON 字符串
}

/**
 * 检测一个 Canvas 区域是否应被视为“固体/障碍物”
 * 算法：计算非透明像素的比例，超过阈值(75%)视为固体
 */
const detectCollision = (ctx: CanvasRenderingContext2D, size: number): boolean => {
  try {
    const imgData = ctx.getImageData(0, 0, size, size);
    const pixels = imgData.data;
    let solidPixels = 0;
    const totalPixels = size * size;

    // 像素数据是 r, g, b, a 排列，每4个一组
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 10) { // Alpha > 10 视为有像素
        solidPixels++;
      }
    }
    
    // 如果超过 75% 的区域有像素，则默认为固体（墙壁/树木根部）
    return (solidPixels / totalPixels) > 0.75;
  } catch (e) {
    return false;
  }
};

/**
 * 主处理函数
 */
export const processImage = async (
  sourceImage: HTMLImageElement,
  options: ProcessOptions
): Promise<ProcessResult> => {
  const { tileSize, mode, columns = 8 } = options;
  
  // 1. 计算网格数量 (丢弃边缘无法凑整的部分)
  const cols = Math.floor(sourceImage.width / tileSize);
  const rows = Math.floor(sourceImage.height / tileSize);
  const totalTilesPossible = cols * rows;

  if (totalTilesPossible === 0) {
    throw new Error("图片尺寸太小，无法切出一张完整的瓦片");
  }

  // 创建临时 Canvas 用于提取像素
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = tileSize;
  tempCanvas.height = tileSize;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!tempCtx) throw new Error("无法创建 Canvas 上下文");

  // 结果 Canvas
  const resultCanvas = document.createElement('canvas');
  const resultCtx = resultCanvas.getContext('2d');
  if (!resultCtx) throw new Error("无法创建结果 Canvas");

  let uniqueCount = 0;
  const resultTiles: TileData[] = [];

  // --- 模式 1: 原样保留 (完整排列图) ---
  if (mode === 'original') {
    const finalWidth = cols * tileSize;
    const finalHeight = rows * tileSize;

    resultCanvas.width = finalWidth;
    resultCanvas.height = finalHeight;

    // 清空背景
    resultCtx.clearRect(0, 0, finalWidth, finalHeight);
    
    // 绘制整图
    resultCtx.drawImage(
      sourceImage, 
      0, 0, finalWidth, finalHeight, 
      0, 0, finalWidth, finalHeight
    );

    uniqueCount = totalTilesPossible; 

    // 生成碰撞数据
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // 为了检测碰撞，我们需要把每个格子单独拿出来读像素
        tempCtx.clearRect(0, 0, tileSize, tileSize);
        tempCtx.drawImage(sourceImage, x * tileSize, y * tileSize, tileSize, tileSize, 0, 0, tileSize, tileSize);
        
        const isSolid = detectCollision(tempCtx, tileSize);
        const id = y * cols + x;

        resultTiles.push({
          id,
          x: x * tileSize,
          y: y * tileSize,
          isSolid
        });
      }
    }
  } 
  
  // --- 模式 2: 紧凑去重 (固定列数，自适应高度) ---
  else if (mode === 'optimized') {
    const uniqueTilesMap = new Map<string, HTMLCanvasElement>();
    const uniqueTilesList: { canvas: HTMLCanvasElement; hash: string }[] = [];

    // 遍历所有格子
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        tempCtx.clearRect(0, 0, tileSize, tileSize);
        tempCtx.drawImage(
          sourceImage,
          x * tileSize, y * tileSize, tileSize, tileSize, 
          0, 0, tileSize, tileSize 
        );

        const tileHash = tempCanvas.toDataURL('image/png');

        if (!uniqueTilesMap.has(tileHash)) {
          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = tileSize;
          tileCanvas.height = tileSize;
          const tileCtx = tileCanvas.getContext('2d');
          tileCtx?.drawImage(tempCanvas, 0, 0);

          uniqueTilesMap.set(tileHash, tileCanvas);
          uniqueTilesList.push({ canvas: tileCanvas, hash: tileHash });
        }
      }
    }

    uniqueCount = uniqueTilesList.length;

    // 计算结果图尺寸
    const outCols = columns; // 固定 8 列
    const outRows = Math.ceil(uniqueCount / outCols);
    
    resultCanvas.width = outCols * tileSize;
    resultCanvas.height = outRows * tileSize;
    resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

    // 绘制所有唯一瓦片并检测碰撞
    uniqueTilesList.forEach((item, index) => {
      const drawCol = index % outCols;
      const drawRow = Math.floor(index / outCols);
      const drawX = drawCol * tileSize;
      const drawY = drawRow * tileSize;

      // 绘制到结果图
      resultCtx.drawImage(item.canvas, drawX, drawY);

      // 检测碰撞 (使用之前保存的小 Canvas)
      const tileTempCtx = item.canvas.getContext('2d');
      const isSolid = tileTempCtx ? detectCollision(tileTempCtx, tileSize) : false;

      resultTiles.push({
        id: index,
        x: drawX,
        y: drawY,
        isSolid
      });
    });
  }

  // 生成 JSON 内容
  const jsonOutput = {
    info: {
      tool: "TileSlicer Pro",
      version: "1.0.0",
      generatedAt: new Date().toISOString()
    },
    config: {
      tileSize,
      mode,
      width: resultCanvas.width,
      height: resultCanvas.height
    },
    tiles: resultTiles.map(t => ({
      id: t.id,
      collision: t.isSolid // 简化字段名
    }))
  };

  return {
    dataUrl: resultCanvas.toDataURL('image/png'),
    width: resultCanvas.width,
    height: resultCanvas.height,
    totalTiles: totalTilesPossible,
    uniqueTiles: uniqueCount,
    tiles: resultTiles,
    jsonContent: JSON.stringify(jsonOutput, null, 2)
  };
};