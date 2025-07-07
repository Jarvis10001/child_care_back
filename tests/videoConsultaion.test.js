describe('Video Consultation API', () => {
    it('should schedule a video consultation', (done) => {
      chai.request(server)
        .post('/api/consultations/schedule')
        .send({
          childId: '123abc',
          date: '2025-04-22',
          doctorId: 'doc456'
        })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('status').eql('scheduled');
          done();
        });
    });
  });
  