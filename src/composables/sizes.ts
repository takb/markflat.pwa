import { onMounted, onUnmounted, reactive, toRefs } from "vue";

const useSizes = () => {
    const sizes = reactive({
        browserWidth: window.innerWidth,
        deviceWidth: screen.width,
        isMobile: false
    })

    
    const browserResized = () => {
        sizes.browserWidth = window.innerWidth
        sizes.deviceWidth = screen.width
        sizes.isMobile = isMobile()
    }

    const isMobile = () => {
        return window.innerWidth <= 1200 ? true : false
    }

    onMounted(() => {
        window.addEventListener('resize', browserResized)
    })

    onUnmounted(() => {
        window.removeEventListener('resize', browserResized)
    })

    // Initial check
    browserResized()
    return {
        ...toRefs(sizes),
    }
}

export default useSizes;
