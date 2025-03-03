import { Position } from '../types/game-config';

export class DrawingHelper {
  static drawMap(ctx: CanvasRenderingContext2D, map: number[][], assets: any, tileSize: number, cameraX: number, cameraY: number): void {
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tileType = map[y][x];
        switch (tileType) {
          case 0: // Wall
            ctx.fillStyle = assets.tiles.wall;
            ctx.fillRect(x * tileSize - cameraX, y * tileSize - cameraY, tileSize, tileSize);
            break;
          case 1: // Floor
            ctx.fillStyle = assets.tiles.floor;
            ctx.fillRect(x * tileSize - cameraX, y * tileSize - cameraY, tileSize, tileSize);
            break;
          case 2: // Up stairs
            ctx.fillStyle = assets.tiles.upStairs;
            ctx.fillRect(x * tileSize - cameraX, y * tileSize - cameraY, tileSize, tileSize);
            break;
          case 3: // Down stairs
            ctx.fillStyle = assets.tiles.downStairs;
            ctx.fillRect(x * tileSize - cameraX, y * tileSize - cameraY, tileSize, tileSize);
            break;
          case 4: // Tree
            ctx.fillStyle = assets.tiles.floor;
            ctx.fillRect(x * tileSize - cameraX, y * tileSize - cameraY, tileSize, tileSize);
            ctx.fillStyle = '#8B4513'; // Saddle brown for trunk
            ctx.fillRect(x * tileSize + tileSize * 0.45 - cameraX, y * tileSize + tileSize * 0.5 - cameraY, tileSize * 0.1, tileSize * 0.5);
            ctx.fillStyle = '#228B22'; // Forest green
            ctx.beginPath();
            ctx.moveTo(x * tileSize + tileSize * 0.2 - cameraX, y * tileSize + tileSize * 0.6 - cameraY);
            ctx.lineTo(x * tileSize + tileSize * 0.8 - cameraX, y * tileSize + tileSize * 0.6 - cameraY);
            ctx.lineTo(x * tileSize + tileSize * 0.5 - cameraX, y * tileSize + tileSize * 0.25 - cameraY);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#32CD32'; // Lime green
            ctx.beginPath();
            ctx.moveTo(x * tileSize + tileSize * 0.25 - cameraX, y * tileSize + tileSize * 0.45 - cameraY);
            ctx.lineTo(x * tileSize + tileSize * 0.75 - cameraX, y * tileSize + tileSize * 0.45 - cameraY);
            ctx.lineTo(x * tileSize + tileSize * 0.5 - cameraX, y * tileSize + tileSize * 0.1 - cameraY);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#90EE90'; // Light green
            ctx.beginPath();
            ctx.moveTo(x * tileSize + tileSize * 0.3 - cameraX, y * tileSize + tileSize * 0.3 - cameraY);
            ctx.lineTo(x * tileSize + tileSize * 0.7 - cameraX, y * tileSize + tileSize * 0.3 - cameraY);
            ctx.lineTo(x * tileSize + tileSize * 0.5 - cameraX, y * tileSize - cameraY);
            ctx.closePath();
            ctx.fill();
            break;
        }
      }
    }
  }

  static drawPlayer(ctx: CanvasRenderingContext2D, player: any, offsetX: number, offsetY: number): void {
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(player.x - offsetX, player.y - offsetY, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  static drawMinimap(ctx: CanvasRenderingContext2D, map: number[][], player: any, tileSize: number, minimapSize: number, minimapScale: number, upStairsPos: Position | null, downStairsPos: Position | null): void {
    const margin = 10;
    const game = (window as any).game;
    ctx.save();
    const mapWidth = map[0].length * tileSize;
    const mapHeight = map.length * tileSize;
    const scaleX = minimapSize / mapWidth;
    const scaleY = minimapSize / mapHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    const scaledWidth = mapWidth * scale;
    const scaledHeight = mapHeight * scale;
    const offsetX = ctx.canvas.width - minimapSize - margin + (minimapSize - scaledWidth) / 2;
    const offsetY = margin + (minimapSize - scaledHeight) / 2;
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tileType = map[y][x];
        if (tileType === 1) {
          ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        } else if (tileType === 4) {
          ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.fillStyle = 'rgba(34, 139, 34, 0.8)';
          ctx.beginPath();
          ctx.moveTo(x * tileSize + tileSize / 2, y * tileSize);
          ctx.lineTo(x * tileSize + tileSize, y * tileSize + tileSize);
          ctx.lineTo(x * tileSize, y * tileSize + tileSize);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    if (upStairsPos) {
      ctx.fillStyle = 'rgba(0, 255, 0, 1)';
      ctx.fillRect(upStairsPos.x * tileSize, upStairsPos.y * tileSize, tileSize, tileSize);
    }
    if (downStairsPos) {
      ctx.fillStyle = 'rgba(255, 165, 0, 1)';
      ctx.fillRect(downStairsPos.x * tileSize, downStairsPos.y * tileSize, tileSize, tileSize);
    }
    const playerTileX = Math.floor(player.x / game.tileSize);
    const playerTileY = Math.floor(player.y / game.tileSize);
    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.fillRect(playerTileX * tileSize, playerTileY * tileSize, tileSize, tileSize);
    ctx.restore();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(ctx.canvas.width - minimapSize - margin, margin, minimapSize, minimapSize);
  }
}