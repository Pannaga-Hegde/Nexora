import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, CommunityPost
from app.auth import create_access_token, get_password_hash

client = TestClient(app)

def test_community_feed_persistence():
    db = SessionLocal()
    try:
        # 1. Create two test users in DB
        u1_id = uuid.uuid4()
        u2_id = uuid.uuid4()
        
        user1 = User(
            id=u1_id,
            username=f"author_{u1_id.hex[:6]}",
            email=f"author_{u1_id.hex[:6]}@example.com",
            full_name="Post Author User",
            password_hash=get_password_hash("pass123"),
            system_role="student",
        )
        user2 = User(
            id=u2_id,
            username=f"viewer_{u2_id.hex[:6]}",
            email=f"viewer_{u2_id.hex[:6]}@example.com",
            full_name="Viewer User",
            password_hash=get_password_hash("pass123"),
            system_role="student",
        )
        db.add(user1)
        db.add(user2)
        db.commit()

        token1 = create_access_token({"sub": str(u1_id), "username": user1.username})
        token2 = create_access_token({"sub": str(u2_id), "username": user2.username})

        auth1_headers = {"Authorization": f"Bearer {token1}"}
        auth2_headers = {"Authorization": f"Bearer {token2}"}

        # 2. Test unauthenticated request rejection (401)
        res_unauth = client.get("/community/posts")
        assert res_unauth.status_code == 401, f"Expected 401 unauthenticated, got {res_unauth.status_code}"
        print("PASS: Unauthenticated list rejected (401)")

        res_unauth_create = client.post("/community/posts", json={"title": "Test", "content": "Test"})
        assert res_unauth_create.status_code == 401, f"Expected 401 unauthenticated, got {res_unauth_create.status_code}"
        print("PASS: Unauthenticated create rejected (401)")

        # 3. User 1 creates a new community post
        post_title = f"Postgres Persistence Architecture {u1_id.hex[:4]}"
        post_content = "Community feed is now 100% persistent in PostgreSQL using SQLAlchemy."
        create_res = client.post(
            "/community/posts",
            headers=auth1_headers,
            json={
                "title": post_title,
                "content": post_content,
                "category": "Tech Discussion"
            }
        )
        assert create_res.status_code == 201, f"Expected 201, got {create_res.status_code}: {create_res.text}"
        post_data = create_res.json()
        post_id = post_data["id"]
        assert post_data["title"] == post_title
        assert post_data["author_id"] == str(u1_id)
        assert post_data["author_name"] == "Post Author User"
        assert post_data["author_role"] == "Student"
        assert post_data["likes_count"] == 0
        print("PASS: User 1 created post (201 Created)")

        # 4. Verify post directly exists in PostgreSQL database table
        db_post = db.get(CommunityPost, uuid.UUID(post_id))
        assert db_post is not None, "Post was not found in PostgreSQL community_posts table!"
        assert db_post.title == post_title
        assert db_post.author_id == u1_id
        print("PASS: Post verified directly in PostgreSQL database table")

        # 5. User 2 lists community posts and verifies seeing User 1's post
        list_res = client.get("/community/posts", headers=auth2_headers)
        assert list_res.status_code == 200, f"Expected 200, got {list_res.status_code}"
        all_posts = list_res.json()
        matching_post = next((p for p in all_posts if p["id"] == post_id), None)
        assert matching_post is not None, "User 2 could not see User 1's post in list!"
        assert matching_post["author_name"] == "Post Author User"
        print("PASS: User 2 retrieved post from PostgreSQL feed list")

        # 6. Test Liking post
        like_res = client.post(f"/community/posts/{post_id}/like", headers=auth2_headers)
        assert like_res.status_code == 200, f"Expected 200, got {like_res.status_code}"
        assert like_res.json()["likes_count"] == 1
        db.refresh(db_post)
        assert db_post.likes_count == 1
        print("PASS: Like increment persisted in PostgreSQL")

        # 7. Non-author (User 2) attempts to delete User 1's post -> Must get 403 Forbidden
        del_unauth_res = client.delete(f"/community/posts/{post_id}", headers=auth2_headers)
        assert del_unauth_res.status_code == 403, f"Expected 403 Forbidden for non-author, got {del_unauth_res.status_code}"
        print("PASS: Non-author delete attempt rejected with 403 Forbidden")

        # Verify post is STILL in database
        db_post_check = db.get(CommunityPost, uuid.UUID(post_id))
        assert db_post_check is not None, "Post was incorrectly deleted by non-author!"
        print("PASS: Post remained intact in PostgreSQL after unauthorized delete attempt")

        # 8. Author (User 1) deletes own post -> Must succeed with 200 OK
        del_res = client.delete(f"/community/posts/{post_id}", headers=auth1_headers)
        assert del_res.status_code == 200, f"Expected 200, got {del_res.status_code}"
        print("PASS: Author successfully deleted own post (200 OK)")

        # 9. Verify post is completely removed from PostgreSQL
        db.expire_all()
        db_post_after = db.get(CommunityPost, uuid.UUID(post_id))
        assert db_post_after is None, "Post was not removed from PostgreSQL community_posts table!"
        print("PASS: Post confirmed deleted from PostgreSQL database table")

        # 10. Verify post no longer appears in feed list
        list_after_res = client.get("/community/posts", headers=auth2_headers)
        all_posts_after = list_after_res.json()
        assert not any(p["id"] == post_id for p in all_posts_after), "Deleted post still appeared in feed list!"
        print("PASS: Deleted post no longer appears in feed list")

        print("\nALL COMMUNITY FEED PERSISTENCE & SECURITY TESTS PASSED PERFECTLY!")

    finally:
        db.close()

if __name__ == "__main__":
    test_community_feed_persistence()
