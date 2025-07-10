import { reactive } from 'vue'

export interface Song {
    id: number;
    title: string;
    artist: string;
    content: string;
}

class Store {
    songbook: Song[] = []
    selected: Song | null = null
    view: string = ''
    apiKeyRead: string = ''
    apiKeyWrite: string = ''
    zoom: number = 1
    edit(id: number) {
        this.selectSong(id)
        this.view = 'edit'
    }
    show(id: number) {
        this.selectSong(id)
        this.view = 'show'
    }
    setContent(content: string) {
        if (this.selected) {
            const matched = content.match(/^#\w*(.+)\w*-\w*(.+)/);
            if (matched) {
                this.selected.title = matched[1].trim()
                this.selected.artist = matched[2].trim()
            }
            this.selected.content = content
        }
    }
    selectSong(id: number) {
        const index = this.songbook.findIndex(song => song.id === id)
        this.selected = index !== -1 ? this.songbook[index] : null
    }
    deleteSong() {
        const id = this.selected?.id
        const index = this.songbook.findIndex(song => song.id === id)
        if (index !== -1) {
            this.songbook.splice(index, 1)
        }
        this.selected = null
    }
    saveSongbook() {
        localStorage.setItem("songbook", JSON.stringify(this.songbook))
    }
    loadSongbook() {
        this.songbook = JSON.parse(localStorage.getItem("songbook") || '[]') 
    }
    saveApiKeys() {
        localStorage.setItem("apiKeyRead", this.apiKeyRead)
        localStorage.setItem("apiKeyWrite", this.apiKeyWrite)
    }
    loadApiKeys() {
        this.apiKeyRead = localStorage.getItem("apiKeyRead") || ''
        this.apiKeyWrite = localStorage.getItem("apiKeyWrite") || ''
    }
    addSong() {
        this.selected = {
            id: this.songbook.length,
            title: 'New song',
            artist: 'Artist',
            content: '# New song - Artist\n1. Verse  \n~Chorus Chorus  \n',
        }
        this.view = 'edit'
    }
    saveSong() {
        if (!this.selected) return
        const id = this.selected?.id
        const index = this.songbook.findIndex(song => song.id === id)
        if (index !== -1) {
            this.songbook.splice(index, 1)
        }
        this.songbook.push(this.selected)
        this.saveSongbook()
    }
}

const store = reactive(new Store())
store.loadSongbook()
store.loadApiKeys()
export default store