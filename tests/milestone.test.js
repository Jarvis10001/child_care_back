describe('Milestone API', () => {
    it('should save child milestone data', (done) => {
      chai.request(server)
        .post('/api/milestones')
        .send({
          childId: '123abc',
          height: 90,
          weight: 12,
          ageInMonths: 24,
          cognitive: 'average'
        })
        .end((err, res) => {
          expect(res).to.have.status(201);
          expect(res.body).to.have.property('success').eql(true);
          done();
        });
    });
  });
  