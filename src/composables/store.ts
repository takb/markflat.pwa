import { reactive } from 'vue'

export interface Song {
    id: number;
    title: string;
    artist: string;
    content: string;
}

class Store {
    songbook: Song[] = [
        { id: 1, title: 'Song 1', artist: 'artist 1', content: 'Content 1' },
        { id: 2, title: 'Song 2', artist: 'artist 2', content: 'Content 2' },
        { id: 3, title: 'Song 3', artist: 'artist 3', content: 'Content 3' },
        { id: 4, title: 'Song 4', artist: 'artist 4', content: 'Content 4' },
        { id: 5, title: 'Song 5', artist: 'artist 2', content: 'Content 2' },
        { id: 6, title: 'Song 6', artist: 'artist 3', content: 'Content 3' },
        { id: 7, title: 'Song 7', artist: 'artist 1', content: 'Content 1' },
        { id: 8, title: 'Song 8', artist: 'artist 2', content: 'Content 2' },
        { id: 9, title: 'Song 9', artist: 'artist 3', content: 'Content 3' },
        { id: 10, title: 'Song 10', artist: 'artist 1', content: 'Content 1' },
        { id: 11, title: 'Song 11', artist: 'artist 2', content: 'Content 2' },
        { id: 12, title: 'Song 12', artist: 'artist 3', content: 'Content 3' },
        { id: 13, title: 'Song 13', artist: 'artist 4', content: 'Content 4' },
        { id: 14, title: 'Song 14', artist: 'artist 2', content: 'Content 2' },
        { id: 15, title: 'Song 15', artist: 'artist 3', content: 'Content 3' },
        { id: 16, title: 'Song 16', artist: 'artist 1', content: 'Content 1' },
        { id: 17, title: 'Song 17', artist: 'artist 2', content: 'Content 2' },
        { id: 18, title: 'Song 18', artist: 'artist 3', content: 'Content 3' },
        { id: 19, title: 'Song 19', artist: 'artist 4', content: 'Content 4' },
        { id: 20, title: 'Song 20', artist: 'artist 2', content: 'Content 2' }
    ]
    selected: Song | null = null
    view: string = ''
    delete(data: any) {
        this.songbook?.splice(this.songbook.indexOf(data), 1)
    }
    edit(data: any) {
        this.selected = data
        this.view = 'edit'
    }
    show(index: number) {
        this.selected = this.songbook[index]
        this.view = 'show'
    }
}

export const store = reactive(new Store())
