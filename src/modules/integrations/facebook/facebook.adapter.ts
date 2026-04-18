export class FacebookAdapter {
  async publishText(pageId: string, message: string, accessToken?: string) {
    if (!message.trim()) throw new Error('Message cannot be empty')
    if (!accessToken) throw new Error(`Facebook page ${pageId} has no access token configured yet.`)

    return {
      postId: `todo-${pageId}-${Date.now()}`,
      message
    }
  }
}

export const facebookAdapter = new FacebookAdapter()
