// 投稿者名を確実に取得するための専用クラス
export class AuthorExtractor {
  
  /**
   * 投稿者名を取得（複数の方法を試行）
   */
  public static async getAuthorName(illustId: string): Promise<string> {
    console.log('[AuthorExtractor] Extracting author name for illust:', illustId);
    
    // 方法1: 作品情報APIから取得（最も確実）
    try {
      const response = await fetch(`/ajax/illust/${illustId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data?.body?.userName) {
          console.log('[AuthorExtractor] Found author from API:', data.body.userName);
          return data.body.userName;
        }
      }
    } catch (error) {
      console.error('[AuthorExtractor] API request failed:', error);
    }
    
    // 方法2: ユーザー情報APIから取得
    try {
      // まずページからユーザーIDを取得
      const userLink = document.querySelector('a[href*="/users/"]');
      if (userLink) {
        const userIdMatch = userLink.getAttribute('href')?.match(/\/users\/(\d+)/);
        if (userIdMatch) {
          const userId = userIdMatch[1];
          const response = await fetch(`/ajax/user/${userId}?full=1`, {
            credentials: 'include',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data?.body?.name) {
              console.log('[AuthorExtractor] Found author from user API:', data.body.name);
              return data.body.name;
            }
          }
        }
      }
    } catch (error) {
      console.error('[AuthorExtractor] User API request failed:', error);
    }
    
    // 方法3: DOM要素から取得（同期的）
    const authorName = this.getAuthorNameFromDOM();
    if (authorName !== 'unknown') {
      return authorName;
    }
    
    // 最終手段: ユーザーIDを使用
    const userIdMatch = document.querySelector('a[href*="/users/"]')?.getAttribute('href')?.match(/\/users\/(\d+)/);
    if (userIdMatch) {
      return `user_${userIdMatch[1]}`;
    }
    
    return 'unknown';
  }
  
  /**
   * DOM要素から投稿者名を取得
   */
  private static getAuthorNameFromDOM(): string {
    // 現在のPixivレイアウトに基づいた取得方法
    
    // 1. data-gtm-user-idを持つリンクから取得
    const gtmLink = document.querySelector('a[data-gtm-user-id]');
    if (gtmLink) {
      const text = gtmLink.textContent?.trim();
      if (text && !text.includes('@')) {
        console.log('[AuthorExtractor] Found from GTM link:', text);
        return text;
      }
    }
    
    // 2. アバター画像の隣のリンクから取得
    const avatarImg = document.querySelector('a[href*="/users/"] img[src*="profile"]');
    if (avatarImg) {
      const parentLink = avatarImg.closest('a');
      if (parentLink && parentLink.nextElementSibling) {
        const nextLink = parentLink.nextElementSibling.querySelector('a[href*="/users/"]');
        if (nextLink) {
          const text = nextLink.textContent?.trim();
          if (text) {
            console.log('[AuthorExtractor] Found next to avatar:', text);
            return text;
          }
        }
      }
    }
    
    // 3. 作者セクション内のリンクから取得
    const authorDivs = document.querySelectorAll('div[class*="sc-"]');
    for (const div of authorDivs) {
      // h2要素を含むdivを探す
      if (div.querySelector('h2')) {
        const authorLink = div.querySelector('a[href*="/users/"]:not(:has(img))');
        if (authorLink) {
          const text = authorLink.textContent?.trim();
          if (text && !text.includes('@')) {
            console.log('[AuthorExtractor] Found in author section:', text);
            return text;
          }
        }
      }
    }
    
    // 4. window.pixivオブジェクトから取得
    const pixivWindow = window as any;
    if (pixivWindow.pixiv?.context?.userName) {
      console.log('[AuthorExtractor] Found from context:', pixivWindow.pixiv.context.userName);
      return pixivWindow.pixiv.context.userName;
    }
    
    return 'unknown';
  }
}

export default AuthorExtractor;