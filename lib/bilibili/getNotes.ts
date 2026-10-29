interface NotesResponse {
  notes: string
}

export async function getBiliNotes(url: string): Promise<string> {
  try {
    const response = await fetch('/api/bilibili/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url })
    })

    if (!response.ok) {
      throw new Error('获取笔记失败')
    }

    const data: NotesResponse = await response.json()
    return data.notes
  } catch (error) {
    console.error('获取笔记失败:', error)
    throw error
  }
}
