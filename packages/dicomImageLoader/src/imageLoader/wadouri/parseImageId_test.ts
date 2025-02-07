import { expect } from 'chai';
import parseImageId from './parseImageId';

describe('parseImageId', () => {
  it('should handle empty imageId', () => {
    const result = parseImageId('');
    expect(result.scheme).to.equal('');
    expect(result.url).to.equal('');
    expect(result.frame).to.equal(0);
    expect(result.pixelDataFrame).to.equal(0);
  });

  it('should parse basic wadouri imageId', () => {
    const result = parseImageId('wadouri:http://example.com/image.dcm');
    expect(result.scheme).to.equal('wadouri');
    expect(result.url).to.equal('http://example.com/image.dcm');
    expect(result.frame).to.be.undefined;
    expect(result.pixelDataFrame).to.be.undefined;
  });

  it('should parse frame using frame= pattern', () => {
    const result = parseImageId('wadouri:http://example.com/image.dcm?frame=2');
    expect(result.frame).to.equal(2);
    expect(result.pixelDataFrame).to.equal(1);
  });

  it('should parse frame using frames/ pattern', () => {
    const result = parseImageId(
      'wadouri:http://example.com/frames/3/image.dcm'
    );
    expect(result.frame).to.equal(3);
    expect(result.pixelDataFrame).to.equal(2);
  });

  it('should parse frame using frameNumber= pattern', () => {
    const result = parseImageId(
      'dicomweb:http://example.com/image.dcm?frameNumber=4'
    );
    expect(result.frame).to.equal(4);
    expect(result.pixelDataFrame).to.equal(3);
  });

  it('should preserve content type and transfer syntax in URL', () => {
    const result = parseImageId(
      'wadouri:http://example.com/image.dcm?frame=2&contentType=application/dicom&transferSyntax=1.2.3'
    );
    expect(result.url).to.include('contentType=application/dicom');
    expect(result.url).to.include('transferSyntax=1.2.3');
  });
});
