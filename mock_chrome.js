window.chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    sendMessage: (msg, callback) => {
      console.log('Message sent:', msg);
      if (msg.type === 'FETCH_FACTORY_INFO') {
        // Simulate API response
        setTimeout(() => {
          callback({
            success: true,
            data: {
              orderId: msg.orderId,
              processList: [
                { processName: '裁剪', producerName: '裁剪工厂(不应选中)' },
                { processName: '车缝', producerName: '车缝工厂(应选中)' },
                { processName: '后整', producerName: '后整工厂(不应选中)' }
              ],
              // Backup plain producer field to test priority
              producer: '默认工厂(不应选中)'
            }
          });
        }, 500);
      }
    },
    lastError: null
  },
  storage: {
    local: {
      get: (keys, cb) => {
        // Default to enabled
        cb({ autoQuery: true, autoFillProducer: true });
      },
      set: (obj, cb) => { console.log('Storage set:', obj); if(cb) cb(); },
    },
    onChanged: { addListener: () => {} }
  }
};
