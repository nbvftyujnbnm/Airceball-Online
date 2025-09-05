document.addEventListener('DOMContentLoaded', function() {
    fetch('header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(data => {
            document.getElementById('header-container').outerHTML = data;

            // --- ここから、ヘッダーが挿入された後に実行したい処理 ---

            // 1. ハンバーガーメニューのクリックイベントを設定 (nav.jsの処理をここに統合)
            const hamburgerBtn = document.getElementById('hamburger-btn');
            const navMenu = document.getElementById('nav-menu');
            if (hamburgerBtn && navMenu) {
                hamburgerBtn.addEventListener('click', () => {
                    // ボタンとメニューに 'active' クラスを付け外しする
                    hamburgerBtn.classList.toggle('active');
                    navMenu.classList.toggle('active');
                    // bodyにクラスをトグルし、背景のスクロールを制御
                    document.body.classList.toggle('menu-open');
                });
            }

            // 2. 現在のページに応じて 'located' クラスを付与
            const currentPage = window.location.pathname.split('/').pop();
            const navLinks = navMenu.querySelectorAll('ul li a');

            navLinks.forEach(link => {
                const linkPage = link.getAttribute('href').split('/').pop();

                if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
                    link.classList.add('located');
                }
            });
        })
        .catch(error => {
            console.error('ヘッダーの読み込みに失敗しました:', error);
            document.getElementById('header-container').innerHTML = '<p>ヘッダーを読み込めません</p>';
        });
});
