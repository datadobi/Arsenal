/**
 * Helper class to ease access to a single data location in metadata
 * 'location' array
 */
class ObjectMDLocation {

    /**
     * @constructor
     * @param {object} locationObj - single data location info
     * @param {string} locationObj.key - data backend key
     * @param {number} locationObj.start - index of first data byte of
     *   this part in the full object
     * @param {number} locationObj.size - byte length of data part
     * @param {string} locationObj.dataStoreName - type of data store
     * @param {string} locationObj.dataStoreETag - internal ETag of
     *   data part
     * @param {string} [locationObj.dataStoreVersionId] - versionId,
     *   needed for cloud backends
     * @param {string} [locationObj.blockId] - blockId of the part,
     *   set by the Azure Blob Service REST API frontend
     */
    constructor(locationObj) {
        this._data = {
            key: locationObj.key,
            start: locationObj.start,
            size: locationObj.size,
            dataStoreName: locationObj.dataStoreName,
            dataStoreETag: locationObj.dataStoreETag,
            dataStoreVersionId: locationObj.dataStoreVersionId,
            blockId: locationObj.blockId,
        };
    }

    getKey() {
        return this._data.key;
    }

    getDataStoreName() {
        return this._data.dataStoreName;
    }

    setDataLocation(location) {
        this._data.key = location.key;
        this._data.dataStoreName = location.dataStoreName;
        this._data.dataStoreVersionId = location.dataStoreVersionId;
        return this;
    }

    getDataStoreETag() {
        return this._data.dataStoreETag;
    }

    getDataStoreVersionId() {
        return this._data.dataStoreVersionId;
    }

    getPartNumber() {
        return Number.parseInt(this._data.dataStoreETag.split(':')[0], 10);
    }

    getPartETag() {
        return this._data.dataStoreETag.split(':')[1];
    }

    getPartStart() {
        return this._data.start;
    }

    getPartSize() {
        return this._data.size;
    }

    setPartSize(size) {
        this._data.size = size;
        return this;
    }

    getBlockId() {
        return this._data.blockId;
    }

    setBlockId(blockId) {
        this._data.blockId = blockId;
        return this;
    }

    getValue() {
        return this._data;
    }
}

module.exports = ObjectMDLocation;
